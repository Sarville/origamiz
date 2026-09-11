/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import bridge from "@vkontakte/vk-bridge";
import { Logger } from "../core/logging";
import { PlatformWrapperImplBrowser } from "./wrapper";

const logger = new Logger("vk-wrapper");

// Must match the item ids the vk-payments-origamiz service (ops/vk-payments/server.js)
// declares in its get_item/order_status_change handling, and the amount hub_goals.js's
// grantCurrencyPackPurchase credits - kept in sync manually, same as Yandex's
// CURRENCY_PACK_PRODUCT_ID/CURRENCY_PACK_AMOUNT.
const CURRENCY_PACK_ITEM_ID = "currency_pack_10k";
const CURRENCY_PACK_AMOUNT = 10000;
const DISABLE_ADS_ITEM_ID = "disable_ads";

// VK caps each storage key at 4096 bytes and silently truncates instead of failing (see
// docs/vk-gotchas.md in the flowit/Colorit project, which hit this in production) - values
// are split into chunks well under that cap. Chosen once and never relied upon to divide
// evenly into anything.
const VK_STORAGE_CHUNK_SIZE = 3800;

// VKWebAppStorageGet only accepts a handful of keys per call; batching keeps a many-chunk
// read (large blueprint libraries) from being rejected outright.
const VK_STORAGE_GET_BATCH = 10;

// VK only appends launch params (vk_user_id, sign, vk_ts, ...) to the URL when the page is
// opened inside a VK client, so their presence is the standard way to tell "running as a VK
// Mini App" apart from a standalone/dev load - vk-bridge itself works either way, it would
// just never get a reply outside VK. Mirrors flowit/Colorit's lib/vkSdk.ts.
function isVkEnvironment() {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("vk_user_id");
}

/**
 * Reads and JSON-parses a possibly-chunked value written by vkStorageSetValue.
 * @param {string} key
 * @returns {Promise<unknown>}
 */
async function vkStorageGetValue(key) {
    const countRes = await bridge.send("VKWebAppStorageGet", { keys: [`${key}#n`] });
    const n = Number(countRes.keys.find(e => e.key === `${key}#n`)?.value) || 0;
    if (n === 0) {
        return undefined;
    }
    const chunkKeys = Array.from({ length: n }, (_, i) => `${key}#${i}`);
    const parts = [];
    for (let i = 0; i < chunkKeys.length; i += VK_STORAGE_GET_BATCH) {
        const batch = chunkKeys.slice(i, i + VK_STORAGE_GET_BATCH);
        const res = await bridge.send("VKWebAppStorageGet", { keys: batch });
        for (const k of batch) {
            parts.push(res.keys.find(e => e.key === k)?.value ?? "");
        }
    }
    try {
        return JSON.parse(parts.join(""));
    } catch (ex) {
        // A crash between writing the new chunks and updating the chunk count (see
        // vkStorageSetValue) can leave a mix of old/new chunks behind - fails loudly here
        // instead of silently accepting corrupt data, same tradeoff as losing the write.
        logger.error(`Corrupt VK storage value for "${key}", discarding:`, ex);
        return undefined;
    }
}

/**
 * Serializes and writes `value` under `key`, chunked to stay under VK's per-key byte cap.
 * Chunks are written before the new count, so a crash mid-write leaves the *old* value
 * readable (stale, not corrupt) rather than a mix of old and new chunks.
 * @param {string} key
 * @param {unknown} value
 */
async function vkStorageSetValue(key, value) {
    const serialized = JSON.stringify(value);
    const newChunks = [];
    for (let i = 0; i < serialized.length; i += VK_STORAGE_CHUNK_SIZE) {
        newChunks.push(serialized.slice(i, i + VK_STORAGE_CHUNK_SIZE));
    }
    const countRes = await bridge.send("VKWebAppStorageGet", { keys: [`${key}#n`] });
    const oldN = Number(countRes.keys.find(e => e.key === `${key}#n`)?.value) || 0;

    for (let i = 0; i < newChunks.length; i++) {
        await bridge.send("VKWebAppStorageSet", { key: `${key}#${i}`, value: newChunks[i] });
    }
    for (let i = newChunks.length; i < oldN; i++) {
        await bridge.send("VKWebAppStorageSet", { key: `${key}#${i}`, value: "" });
    }
    await bridge.send("VKWebAppStorageSet", { key: `${key}#n`, value: String(newChunks.length) });
}

// The only top-level keys ever passed to getCloudData/setCloudData (see achievements_storage.js,
// wallet_storage.js, blueprint_library_storage.js) - getCloudData has to know these upfront since
// each one is its own VK storage entry (see vkStorageGetValue/vkStorageSetValue) rather than one
// combined blob. Add a new one here if a future caller introduces another top-level key.
const CLOUD_DATA_KEYS = ["wallet", "unlocked", "blueprintLibrary"];

export class PlatformWrapperImplVk extends PlatformWrapperImplBrowser {
    /** @param {Application} app */
    constructor(app) {
        super(app);
        this.inVk = isVkEnvironment();
        this.adsDisabled = false;

        // Currency-pack purchases confirmed by the vk-payments-origamiz webhook but not yet
        // credited to this session's wallet (e.g. the previous session closed before crediting) -
        // fetched in initialize(), credited by consumeUnprocessedPurchases(). Mirrors
        // PlatformWrapperImplYandex's unconsumedCurrencyPackPurchases.
        this.pendingCurrencyPackOrderIds = [];

        // Serializes setCloudData calls so each key's chunked read-modify-write can't race a
        // concurrent one - same reasoning as PlatformWrapperImplYandex's cloudWriteQueue.
        this.cloudWriteQueue = Promise.resolve();
    }

    async initialize() {
        await super.initialize();
        if (!this.inVk) {
            return;
        }
        try {
            await bridge.send("VKWebAppInit");
        } catch (ex) {
            logger.error("VKWebAppInit failed, continuing without VK bridge:", ex);
            this.inVk = false;
            return;
        }
        try {
            const entitlements = await this.fetchEntitlements();
            this.adsDisabled = Boolean(entitlements?.adsDisabled);
            this.pendingCurrencyPackOrderIds = entitlements?.pendingCurrencyPacks ?? [];
        } catch (ex) {
            logger.error("Failed to fetch VK entitlements, continuing without them:", ex);
        }
    }

    getId() {
        return "vk";
    }

    /**
     * VK doesn't expose a client-side "list my purchases" API the way Yandex does (an order
     * box call is just a one-off payment event) - entitlements are looked up from our own
     * vk-payments-origamiz service instead, which records them from VK's payment webhook.
     * The request is authenticated with the same launch-params query string VK appended to
     * this page's own URL, which the server re-validates (see ops/vk-payments/server.js).
     */
    async fetchEntitlements() {
        const res = await fetch(`/vk/origamiz-entitlements${window.location.search}`);
        if (!res.ok) {
            return null;
        }
        return res.json();
    }

    async consumeUnprocessedPurchases() {
        for (const orderId of this.pendingCurrencyPackOrderIds) {
            await this.creditAndConsumeCurrencyPack(orderId);
        }
        this.pendingCurrencyPackOrderIds = [];
    }

    /**
     * The only place a currency-pack order is ever credited - called either for orders left
     * over from a previous session (consumeUnprocessedPurchases) or, via
     * waitForPendingCurrencyPackAndCredit, right after this session's own purchase. Crediting
     * and consuming (telling the server to drop the order from its pending list) always
     * happen together so an order can never be picked up and credited twice from the two
     * different signals (VK's order-box success vs. the payments webhook).
     * @param {string} orderId
     */
    async creditAndConsumeCurrencyPack(orderId) {
        try {
            this.app.wallet.credit(CURRENCY_PACK_AMOUNT);
            await fetch(`/vk/origamiz-consume${window.location.search}&orderId=${encodeURIComponent(orderId)}`, {
                method: "POST",
            });
        } catch (ex) {
            logger.error("Failed to consume VK currency-pack purchase:", ex);
        }
    }

    getSupportsCrossDeviceWallet() {
        return true;
    }

    async getCloudData() {
        if (!this.inVk) {
            return super.getCloudData();
        }
        const result = {};
        for (const key of CLOUD_DATA_KEYS) {
            try {
                const value = await vkStorageGetValue(key);
                if (value !== undefined) {
                    result[key] = value;
                }
            } catch (ex) {
                logger.error(`Failed to read VK storage key "${key}":`, ex);
            }
        }
        return result;
    }

    /** @param {Record<string, unknown>} patch */
    async setCloudData(patch) {
        if (!this.inVk) {
            return super.setCloudData(patch);
        }
        this.cloudWriteQueue = this.cloudWriteQueue.then(async () => {
            for (const [key, value] of Object.entries(patch)) {
                try {
                    await vkStorageSetValue(key, value);
                } catch (ex) {
                    logger.error(`Failed to write VK storage key "${key}":`, ex);
                }
            }
        });
        return this.cloudWriteQueue;
    }

    onGameReady() {
        if (!this.inVk || this.adsDisabled) {
            return;
        }
        bridge
            .send("VKWebAppCheckBannerAd")
            .then(res => (res.result ? bridge.send("VKWebAppShowBannerAd", { banner_location: "top" }) : null))
            .catch(ex => logger.error("VK banner ad failed:", ex));
    }

    getSupportsRewardedAds() {
        return this.inVk;
    }

    async showRewardedAd() {
        if (!this.inVk) {
            return false;
        }
        try {
            const check = await bridge.send("VKWebAppCheckNativeAds", { ad_format: "reward" });
            if (!check.result) {
                return false;
            }
            this.app.sound.setMuted(true);
            const res = await bridge.send("VKWebAppShowNativeAds", { ad_format: "reward" });
            return Boolean(res.result);
        } catch (ex) {
            logger.error("VK rewarded ad failed:", ex);
            return false;
        } finally {
            this.app.sound.setMuted(false);
        }
    }

    getSupportsAdRemovalPurchase() {
        return this.inVk;
    }

    getAdsDisabled() {
        return this.adsDisabled;
    }

    async purchaseAdRemoval() {
        if (!this.inVk) {
            return false;
        }
        try {
            const res = await bridge.send("VKWebAppShowOrderBox", { type: "item", item: DISABLE_ADS_ITEM_ID });
            // @vkontakte/vk-bridge's types declare a `status` field that the real client never
            // sends - it responds with `{success, order_id}` instead (see docs/vk-gotchas.md in
            // the flowit/Colorit project, which hit this the hard way). Check `success`.
            if (!res.success) {
                return false;
            }
            this.adsDisabled = true;
            bridge.send("VKWebAppHideBannerAd").catch(() => {});
            return true;
        } catch (ex) {
            logger.error("VK ad-removal purchase failed:", ex);
            return false;
        }
    }

    getSupportsCurrencyPackPurchase() {
        return this.inVk;
    }

    async purchaseCurrencyPack() {
        if (!this.inVk) {
            return false;
        }
        try {
            const res = await bridge.send("VKWebAppShowOrderBox", { type: "item", item: CURRENCY_PACK_ITEM_ID });
            if (!res.success) {
                return false;
            }
            await this.waitForPendingCurrencyPackAndCredit(res.order_id);
            return true;
        } catch (ex) {
            logger.error("VK currency-pack purchase failed:", ex);
            return false;
        }
    }

    /**
     * VK's order-box success and our own payments webhook (the actual source of truth for
     * crediting - see creditAndConsumeCurrencyPack) are two independent signals that can
     * arrive in either order. Polls briefly for the webhook to catch up so the common case
     * credits instantly; if it takes longer than this budget, the credit simply happens on
     * the next reload's consumeUnprocessedPurchases once the webhook does arrive - never
     * credited here without also being consumed, so there is no double-credit window.
     * @param {string} orderId
     */
    async waitForPendingCurrencyPackAndCredit(orderId) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const entitlements = await this.fetchEntitlements().catch(() => null);
            if (entitlements?.pendingCurrencyPacks?.includes(orderId)) {
                await this.creditAndConsumeCurrencyPack(orderId);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        logger.warn(
            `VK currency-pack order ${orderId} not yet confirmed by the payments webhook - ` +
                "will be credited on next load once it arrives."
        );
    }

    async showInterstitialAd() {
        if (!this.inVk || this.adsDisabled) {
            return false;
        }
        try {
            const check = await bridge.send("VKWebAppCheckNativeAds", { ad_format: "interstitial" });
            if (!check.result) {
                return false;
            }
            this.app.sound.setMuted(true);
            const res = await bridge.send("VKWebAppShowNativeAds", { ad_format: "interstitial" });
            return Boolean(res.result);
        } catch (ex) {
            logger.error("VK interstitial ad failed:", ex);
            return false;
        } finally {
            this.app.sound.setMuted(false);
        }
    }
}
