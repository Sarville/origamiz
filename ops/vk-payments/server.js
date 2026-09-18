const http = require("http");
const fs = require("fs");
const crypto = require("crypto");

const APP_SECRET = process.env.VK_APP_SECRET || "";

// Persistent entitlement ledger, keyed by vk_user_id. VK's Mini App bridge has no client-side
// "list my purchases" API (an order-box call is just a one-off payment event, unlike Yandex's
// SDK) - this file is the only record of who owns what, built up from the payments webhook
// below. Bind-mounted from the host so it survives container restarts/redeploys.
const DATA_FILE = process.env.DATA_FILE || "/data/entitlements.json";

// One JSON file per vk_user_id holding that player's savegame bundle (src/js/platform/vk_wrapper.js's
// getSavegameBundle/setSavegameBundle) - kept out of entitlements.json (which stays small and fully
// in-memory) since these can be much bigger and there's no reason to load every player's savegames
// into memory just to answer one player's request.
const SAVEGAMES_DIR = process.env.SAVEGAMES_DIR || "/data/savegames";
fs.mkdirSync(SAVEGAMES_DIR, { recursive: true });

// ponytail: flat ceiling, not tuned to any real savegame's measured size - raise if legitimate
// players hit it (a shapez factory dump is text-serialized JSON, so a few MB covers a very large
// base; this mainly exists to stop someone POSTing an arbitrarily large body at the endpoint).
const MAX_SAVEGAME_BUNDLE_BYTES = 16 * 1024 * 1024;

function isValidVkUserId(vkUserId) {
    // VK/OK user ids are always numeric - reject anything else outright so it can never be used
    // to build a filesystem path (no traversal characters possible in a digits-only string).
    return typeof vkUserId === "string" && /^[0-9]+$/.test(vkUserId);
}

// disable_ads: one-time, permanent. currency_pack_10k: repeatable, credits 10000 currency (see
// hub_goals.js's CURRENCY_PACK_AMOUNT). `price` is VK's "голоса", `priceOk` is OK's "ОКи" - the two
// don't convert 1:1 to RUB or to each other, so both are set explicitly from each platform's own
// purchase-pack cabinet rather than assumed. See docs/vk-ok-payments-findings.md.
const ITEMS = {
    disable_ads: { title: "Отключить рекламу", price: 20, priceOk: 120 },
    currency_pack_10k: { title: "Пак валюты", price: 10, priceOk: 80 },
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
    // VK's vk_ts is Unix seconds, but an OK-hosted launch (vk_client=ok) sends it in
    // milliseconds instead (confirmed from a real captured OK launch: vk_ts=1789483279190 vs
    // VK's vk_ts=1789477153) - unnormalized, that reads as a wildly negative age and 403s every
    // real OK player. Seconds-since-epoch won't reach 1e11 until year 5138, so anything past
    // that threshold is unambiguously milliseconds.
    let ts = Number(searchParams.get("vk_ts"));
    if (ts > 1e11) {
        ts /= 1000;
    }
    const ageSeconds = Date.now() / 1000 - ts;
    return Boolean(ts) && ageSeconds >= -60 && ageSeconds <= LAUNCH_MAX_AGE_SECONDS;
}

// Soft check, on top of the sign - see flowit/Colorit's docs/vk-gotchas.md for the full
// rationale (missing Referer is not punished, only a present-but-wrong one is). ok.ru is included
// defensively for OK-hosted launches (vk_client=ok) - not confirmed against a real OK launch's
// actual Referer, so this could still wrongly 403 real OK players if OK sends something else;
// check a real captured OK request before trusting this (see docs/vk-ok-payments-findings.md).
function isAcceptableReferer(referer) {
    if (!referer) {
        return true;
    }
    try {
        const host = new URL(referer).hostname;
        return (
            host === "vk.com" ||
            host.endsWith(".vk.com") ||
            host === "vk.ru" ||
            host.endsWith(".vk.ru") ||
            host === "ok.ru" ||
            host.endsWith(".ok.ru")
        );
    } catch {
        return false;
    }
}

// OK (Odnoklassniki) is a mode of this same VK Mini App, not a separate platform - one app, one
// APP_SECRET, same isValidSig formula. `get_item` for an OK purchase still arrives on the classic
// POST channel below (with site=ok, handled there); this GET is OK's *separate* purchase
// confirmation ("chargeable" equivalent) - apiok.ru `callbacks.payment` - which must be set as its
// own "URL для платёжных уведомлений Одноклассников" in the dev.vk.ru cabinet. Response shape is
// OK-specific: bare JSON `true` on success, {error_code,...} plus an Invocation-error header on
// failure. Not verified against a real captured OK notification yet - check a real request from
// OK's "Тестовый" probe before trusting this in production (see docs/vk-ok-payments-findings.md).
async function handleOkPaymentNotification(searchParams, res) {
    const params = Object.fromEntries(searchParams);

    function fail(code, msg) {
        res.writeHead(200, { "Content-Type": "application/json", "Invocation-error": String(code) });
        res.end(JSON.stringify({ error_code: code, error_msg: msg, error_data: null }));
    }

    if (!isValidSig(params)) {
        return fail(1001, "CALLBACK_INVALID_SIGNATURE: invalid sig");
    }
    if (!params.uid || !params.transaction_id || !params.transaction_time || !params.amount) {
        return fail(1001, "CALLBACK_INVALID_PAYMENT: missing required field");
    }
    const item = ITEMS[params.product_code];
    if (!item || Number(params.amount) !== item.priceOk) {
        return fail(1001, "CALLBACK_INVALID_PAYMENT: unknown item or price");
    }

    const user = getUser(params.uid);
    if (params.product_code === "disable_ads") {
        user.adsDisabled = true;
    } else if (!user.pendingCurrencyPacks.includes(params.transaction_id)) {
        user.pendingCurrencyPacks.push(params.transaction_id);
    }
    await persist();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("true");
}

function readBody(req, maxBytes = Infinity) {
    return new Promise((resolve, reject) => {
        let body = "";
        let bytes = 0;
        req.on("data", chunk => {
            bytes += chunk.length;
            if (bytes > maxBytes) {
                req.destroy();
                reject(Object.assign(new Error("payload too large"), { tooLarge: true }));
                return;
            }
            body += chunk;
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
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

    // Cross-device/cross-platform progress sync (src/js/platform/vk_wrapper.js's
    // getSavegameBundle/setSavegameBundle) - required by VK's rule 2.3.8. Same launch-params auth
    // as the entitlement endpoints above; storage is a flat per-user JSON file (see SAVEGAMES_DIR),
    // never held in memory across requests.
    if (req.method === "GET" && url.pathname === "/vk/origamiz-savegames") {
        if (!isValidLaunchParams(url.searchParams)) {
            res.writeHead(403);
            return res.end();
        }
        const vkUserId = url.searchParams.get("vk_user_id");
        if (!isValidVkUserId(vkUserId)) {
            res.writeHead(400);
            return res.end();
        }
        try {
            const contents = await fs.promises.readFile(`${SAVEGAMES_DIR}/${vkUserId}.json`, "utf8");
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(contents);
        } catch {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end("null");
        }
    }

    if (req.method === "POST" && url.pathname === "/vk/origamiz-savegames") {
        if (!isValidLaunchParams(url.searchParams)) {
            res.writeHead(403);
            return res.end();
        }
        const vkUserId = url.searchParams.get("vk_user_id");
        if (!isValidVkUserId(vkUserId)) {
            res.writeHead(400);
            return res.end();
        }
        let body;
        try {
            body = await readBody(req, MAX_SAVEGAME_BUNDLE_BYTES);
        } catch (ex) {
            res.writeHead(ex.tooLarge ? 413 : 400);
            return res.end();
        }
        try {
            JSON.parse(body); // reject non-JSON bodies before persisting them
        } catch {
            res.writeHead(400);
            return res.end();
        }
        await fs.promises.writeFile(`${SAVEGAMES_DIR}/${vkUserId}.json`, body);
        res.writeHead(200);
        return res.end();
    }

    if (req.method === "GET" && url.pathname === "/vk/origamiz-payments/ok") {
        return await handleOkPaymentNotification(url.searchParams, res);
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
            // `site` tells apart a lookup triggered from the VK client vs the OK client - both
            // arrive on this same classic endpoint (OK only gets its own separate channel for the
            // purchase *confirmation*, handled above), so this is the one place that needs to
            // answer with the right currency's price for whichever platform is asking. Confirmed
            // from a real captured OK request: the value is "OK", not "ok" - lowercase it before
            // comparing, or this silently always answers with the VK price.
            const price = (params.site || "").toLowerCase() === "ok" ? item.priceOk : item.price;
            return res.end(JSON.stringify({ response: { title: item.title, price, item_id: params.item } }));
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

module.exports = { server, isValidSig, isValidLaunchParams, isAcceptableReferer, handleOkPaymentNotification };
