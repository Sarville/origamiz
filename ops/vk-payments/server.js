const http = require("http");
const fs = require("fs");
const crypto = require("crypto");

const APP_SECRET = process.env.VK_APP_SECRET || "";

// Persistent entitlement ledger, keyed by vk_user_id. VK's Mini App bridge has no client-side
// "list my purchases" API (an order-box call is just a one-off payment event, unlike Yandex's
// SDK) - this file is the only record of who owns what, built up from the payments webhook
// below. Bind-mounted from the host so it survives container restarts/redeploys.
const DATA_FILE = process.env.DATA_FILE || "/data/entitlements.json";

// disable_ads (one-time, permanent) mirrors Origamiz's Yandex build at 150 rub; currency_pack_10k
// (repeatable, credits 10000 currency - see hub_goals.js's CURRENCY_PACK_AMOUNT) mirrors 100 rub.
// VK charges in "voices" (голоса) - confirmed 1 voice = 1 rub for this app, so price is just the
// target rouble amount.
const ITEMS = {
    disable_ads: { title: "Отключить рекламу", price: 150 },
    currency_pack_10k: { title: "Пак валюты", price: 100 },
};

let entitlements = {};
try {
    entitlements = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch {
    entitlements = {};
}

// Serializes writes so two webhook requests arriving close together (e.g. VK retrying a
// notification) can't race each other's read-modify-write of the same file.
let writeQueue = Promise.resolve();
function persist() {
    const write = () => fs.promises.writeFile(DATA_FILE, JSON.stringify(entitlements));
    writeQueue = writeQueue.then(write, write); // keep chaining even if a previous write failed
    return writeQueue;
}

function getUser(vkUserId) {
    if (!entitlements[vkUserId]) {
        entitlements[vkUserId] = { adsDisabled: false, pendingCurrencyPacks: [] };
    }
    return entitlements[vkUserId];
}

// VK's classic Payments API signature: md5 of every param except sig, sorted by name and
// concatenated as name=value with no separator, plus the app's secret key appended. Same
// algorithm as flowit/Colorit's ops/vk-payments/server.js - see its docs/vk-gotchas.md.
function isValidSig(params) {
    if (!APP_SECRET) {
        return false;
    }
    const { sig, ...rest } = params;
    const joined = Object.keys(rest)
        .sort()
        .map(key => `${key}=${rest[key]}`)
        .join("");
    const expected = crypto
        .createHash("md5")
        .update(joined + APP_SECRET)
        .digest("hex");
    return sig === expected;
}

// VK's Mini App *launch params* signature - a different scheme from the Payments one above
// (HMAC-SHA256, not md5), over just the vk_-prefixed params, base64url-encoded. This is what
// proves a request actually came from a fresh VK launch and wasn't just a copy-pasted URL, and
// gates both the game page itself (via Caddy forward_auth) and every entitlements/consume call
// this service answers.
const LAUNCH_MAX_AGE_SECONDS = 8 * 60 * 60; // ponytail: tune if real sessions need to live longer

function isValidLaunchParams(searchParams) {
    if (!APP_SECRET) {
        return false;
    }
    const sign = searchParams.get("sign");
    if (!sign) {
        return false;
    }
    const vkKeys = [...searchParams.keys()].filter(k => k.startsWith("vk_")).sort();
    const joined = vkKeys.map(k => `${k}=${searchParams.get(k)}`).join("&");
    const expected = crypto
        .createHmac("sha256", APP_SECRET)
        .update(joined)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    if (expected !== sign) {
        return false;
    }
    const ts = Number(searchParams.get("vk_ts"));
    const ageSeconds = Date.now() / 1000 - ts;
    return Boolean(ts) && ageSeconds >= -60 && ageSeconds <= LAUNCH_MAX_AGE_SECONDS;
}

// Soft check, on top of the sign - see flowit/Colorit's docs/vk-gotchas.md for the full
// rationale (missing Referer is not punished, only a present-but-wrong one is).
function isAcceptableReferer(referer) {
    if (!referer) {
        return true;
    }
    try {
        const host = new URL(referer).hostname;
        return host === "vk.com" || host.endsWith(".vk.com") || host === "vk.ru" || host.endsWith(".vk.ru");
    } catch {
        return false;
    }
}

function readBody(req) {
    return new Promise(resolve => {
        let body = "";
        req.on("data", chunk => {
            body += chunk;
        });
        req.on("end", () => resolve(body));
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://placeholder");

    // Gate for the game page itself: Caddy's forward_auth mirrors the original request here
    // before deciding whether to serve the file - see ops/Caddyfile.
    if (req.method === "GET" && (url.pathname === "/vk/origamiz" || url.pathname === "/vk/origamiz/")) {
        const ok = isValidLaunchParams(url.searchParams) && isAcceptableReferer(req.headers.referer);
        res.writeHead(ok ? 200 : 403);
        return res.end();
    }

    // Client-side entitlement lookup (src/js/platform/vk_wrapper.js's fetchEntitlements) -
    // authenticated with the same launch-params query string VK appended to the game's own URL.
    if (req.method === "GET" && url.pathname === "/vk/origamiz-entitlements") {
        if (!isValidLaunchParams(url.searchParams)) {
            res.writeHead(403);
            return res.end();
        }
        const user = getUser(url.searchParams.get("vk_user_id"));
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(user));
    }

    // Marks a currency-pack order as consumed (src/js/platform/vk_wrapper.js's
    // creditAndConsumeCurrencyPack) - removes it from pendingCurrencyPacks so it can't be
    // picked up and credited a second time on a future load.
    if (req.method === "POST" && url.pathname === "/vk/origamiz-consume") {
        if (!isValidLaunchParams(url.searchParams)) {
            res.writeHead(403);
            return res.end();
        }
        const user = getUser(url.searchParams.get("vk_user_id"));
        const orderId = url.searchParams.get("orderId");
        user.pendingCurrencyPacks = user.pendingCurrencyPacks.filter(id => id !== orderId);
        await persist();
        res.writeHead(200);
        return res.end();
    }

    // VK's payments callback (get_item / order_status_change) - set as this app's callback URL
    // in the VK admin panel's payments cabinet.
    if (req.method === "POST" && url.pathname === "/vk/origamiz-payments") {
        const body = await readBody(req);
        const params = Object.fromEntries(new URLSearchParams(body));
        res.writeHead(200, { "Content-Type": "application/json" });

        if (!isValidSig(params)) {
            return res.end(JSON.stringify({ error: { error_code: 10, error_msg: "Invalid signature" } }));
        }

        // VK's "Test" button in the payments cabinet sends the same notifications with
        // "_test" appended to notification_type - strip it so the sandbox probe gets the same
        // valid response as a real notification.
        const notificationType = (params.notification_type || "").replace(/_test$/, "");
        const item = ITEMS[params.item];

        if (notificationType === "get_item" && item) {
            return res.end(JSON.stringify({ response: { title: item.title, price: item.price, item_id: params.item } }));
        }

        if (notificationType === "order_status_change" && params.status === "chargeable" && item) {
            const user = getUser(params.user_id);
            if (params.item === "disable_ads") {
                user.adsDisabled = true;
            } else if (params.item === "currency_pack_10k" && !user.pendingCurrencyPacks.includes(params.order_id)) {
                user.pendingCurrencyPacks.push(params.order_id);
            }
            await persist();
            return res.end(
                JSON.stringify({ response: { order_id: Number(params.order_id), app_order_id: Number(params.order_id) } })
            );
        }

        return res.end(JSON.stringify({ error: { error_code: 20, error_msg: "Unknown item or notification" } }));
    }

    res.writeHead(404);
    res.end();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`vk-payments-origamiz listening on :${PORT}`));

module.exports = { server, isValidSig, isValidLaunchParams, isAcceptableReferer };
