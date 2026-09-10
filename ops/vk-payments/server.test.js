// Minimal self-check for server.js's signature validation, entitlement ledger, and payments
// webhook - run with `node ops/vk-payments/server.test.js`. Not a framework/CI suite, just a
// runnable guard against breaking the money/security path (launch-auth gate + purchases).
const assert = require("assert");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const APP_SECRET = "test_secret";
const PORT = 34121;
const DATA_FILE = path.join(require("os").tmpdir(), `vk-payments-test-${Date.now()}.json`);

process.env.VK_APP_SECRET = APP_SECRET;
process.env.DATA_FILE = DATA_FILE;
process.env.PORT = String(PORT);

const { server } = require("./server.js");

function signLaunchParams(params) {
    const vkKeys = Object.keys(params)
        .filter(k => k.startsWith("vk_"))
        .sort();
    const joined = vkKeys.map(k => `${k}=${params[k]}`).join("&");
    return crypto
        .createHmac("sha256", APP_SECRET)
        .update(joined)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function launchQuery(vkUserId, overrides = {}) {
    const params = { vk_user_id: vkUserId, vk_ts: String(Math.floor(Date.now() / 1000)), ...overrides };
    const sign = signLaunchParams(params);
    return new URLSearchParams({ ...params, sign }).toString();
}

function signPaymentParams(params) {
    const joined = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join("");
    return crypto.createHash("md5").update(joined + APP_SECRET).digest("hex");
}

async function request(method, urlPath, body) {
    const res = await fetch(`http://127.0.0.1:${PORT}${urlPath}`, {
        method,
        body,
        headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function main() {
    const gameQuery = launchQuery("123");

    // Launch-auth gate: valid signature -> 200, tampered param -> 403.
    assert.strictEqual((await request("GET", `/vk/origamiz?${gameQuery}`)).status, 200, "valid launch params should pass the gate");
    assert.strictEqual(
        (await request("GET", `/vk/origamiz?${gameQuery}&vk_user_id=999`)).status,
        403,
        "tampering with a signed param must fail the gate"
    );

    // Fresh user has no entitlements yet.
    let entitlements = (await request("GET", `/vk/origamiz-entitlements?${gameQuery}`)).body;
    assert.deepStrictEqual(entitlements, { adsDisabled: false, pendingCurrencyPacks: [] }, "new user starts with no entitlements");

    // get_item webhook (including the "_test" suffix VK's sandbox probe sends).
    const getItemParams = { notification_type: "get_item_test", item: "currency_pack_10k" };
    const getItemRes = await request(
        "POST",
        "/vk/origamiz-payments",
        new URLSearchParams({ ...getItemParams, sig: signPaymentParams(getItemParams) }).toString()
    );
    assert.strictEqual(getItemRes.body.response.item_id, "currency_pack_10k", "get_item should describe the requested item");

    // order_status_change webhook credits the order as pending for that VK user.
    const orderParams = {
        notification_type: "order_status_change",
        item: "currency_pack_10k",
        status: "chargeable",
        order_id: "555",
        user_id: "123",
    };
    await request(
        "POST",
        "/vk/origamiz-payments",
        new URLSearchParams({ ...orderParams, sig: signPaymentParams(orderParams) }).toString()
    );
    entitlements = (await request("GET", `/vk/origamiz-entitlements?${gameQuery}`)).body;
    assert.deepStrictEqual(entitlements.pendingCurrencyPacks, ["555"], "webhook should record the pending order");

    // An invalid payment signature must never be trusted.
    const forgedRes = await request(
        "POST",
        "/vk/origamiz-payments",
        new URLSearchParams({ ...orderParams, order_id: "666", sig: "deadbeef" }).toString()
    );
    assert.strictEqual(forgedRes.body.error.error_code, 10, "forged payment signature must be rejected");

    // Consuming removes the order so it can't be credited twice.
    await request("POST", `/vk/origamiz-consume?${gameQuery}&orderId=555`);
    entitlements = (await request("GET", `/vk/origamiz-entitlements?${gameQuery}`)).body;
    assert.deepStrictEqual(entitlements.pendingCurrencyPacks, [], "consumed order should be removed from pending");

    console.log("All vk-payments server checks passed.");
}

main()
    .catch(err => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => {
        server.close();
        fs.rmSync(DATA_FILE, { force: true });
    });
