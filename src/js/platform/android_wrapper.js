/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { registerPlugin } from "@capacitor/core";
import { YandexAds } from "@quenary/capacitor-yandex-ads";
import { Logger } from "../core/logging";
import { PlatformWrapperImplBrowser } from "./wrapper";

const logger = new Logger("android-wrapper");

// Product ids must match RuStore Console -> Monetization: "disable_ads" NON_CONSUMABLE, "currency_pack_10k"
// CONSUMABLE (same ids as the Yandex/VK builds). CURRENCY_PACK_AMOUNT must match hub_goals.js, duplicated for the
// same reason as in yandex_wrapper.js (the sweep runs before any savegame exists).
const DISABLE_ADS_PRODUCT_ID = "disable_ads";
const CURRENCY_PACK_PRODUCT_ID = "currency_pack_10k";
const CURRENCY_PACK_AMOUNT = 10000;

// Real "R-M-..." ad unit ids from the Yandex РСЯ cabinet, passed at build time (see docs/android-rustore.md).
// Unset = Yandex's public demo units, which are served but never pay.
const BANNER_ID = G_YAN_BANNER_ID;
const INTERSTITIAL_ID = G_YAN_INTERSTITIAL_ID;
const REWARDED_ID = G_YAN_REWARDED_ID;

// Fallback for offline launches, where the RuStore purchase list can't be fetched.
const ADS_DISABLED_KEY = "origamiz_ads_disabled";

/** @typedef {{ purchaseId: string, productId: string, productType: string, status: string, acknowledgement: string }} RuStorePurchase */

// Bridge to android/app/src/main/java/ru/sarville/origamiz/RuStorePayPlugin.java
const RuStorePay = registerPlugin(/** @type {string} */ ("RuStorePay"));

/** A finished one-step purchase reports PAID or CONFIRMED (unverified on a device - test with a test payment). */
const isPaid = (/** @type {RuStorePurchase} */ p) => p.status === "PAID" || p.status === "CONFIRMED";

export class PlatformWrapperImplAndroid extends PlatformWrapperImplBrowser {
    /** @param {Application} app */
    constructor(app) {
        super(app);
        this.adsDisabled = false;
        /** @type {RuStorePurchase[]} */
        this.unacknowledgedCurrencyPacks = [];

        this.adsInit = null;
        this.interstitialReady = false;
        this.bannerLoaded = false;
        /** @type {(() => void) | null} */
        this.onInterstitialDone = null;
    }

    getId() {
        return "android";
    }

    async initialize() {
        await super.initialize();
        try {
            this.adsDisabled = localStorage.getItem(ADS_DISABLED_KEY) === "1";
        } catch (ex) {
            // storage unavailable - keep the default
        }

        try {
            /** @type {{ purchases: RuStorePurchase[] }} */
            const { purchases } = await RuStorePay.getPurchases();
            const paid = purchases.filter(isPaid);
            this.adsDisabled = paid.some(p => p.productId === DISABLE_ADS_PRODUCT_ID);
            this.storeAdsDisabled();
            // Bought but never acknowledged last session (app died between payment and delivery) - credited
            // later by consumeUnprocessedPurchases(), once the wallet has hydrated.
            this.unacknowledgedCurrencyPacks = paid.filter(
                p => p.productId === CURRENCY_PACK_PRODUCT_ID && p.acknowledgement === "PENDING"
            );
        } catch (ex) {
            logger.error(
                "Failed to read RuStore purchases (offline / not signed in?), using local flag:",
                ex
            );
        }
    }

    storeAdsDisabled() {
        try {
            localStorage.setItem(ADS_DISABLED_KEY, this.adsDisabled ? "1" : "0");
        } catch (ex) {
            // best effort only
        }
    }

    /**
     * Credits, then acknowledges, currency packs whose delivery got interrupted last session. Must run after
     * app.wallet hydrated (crediting earlier would be overwritten). Credit first, acknowledge second: a failed
     * acknowledge just repeats next launch, while acknowledging first could lose a paid-for pack.
     */
    async consumeUnprocessedPurchases() {
        for (const purchase of this.unacknowledgedCurrencyPacks) {
            try {
                this.app.wallet.credit(CURRENCY_PACK_AMOUNT);
                await RuStorePay.acknowledge({ purchaseId: purchase.purchaseId });
            } catch (ex) {
                logger.error("Failed to acknowledge unprocessed currency-pack purchase:", ex);
            }
        }
        this.unacknowledgedCurrencyPacks = [];
    }

    // --- Ads (Yandex Mobile Ads / РСЯ) ---

    /**
     * Initialises the SDK once; a failure clears the cache so the next call retries (e.g. was offline). Resolves to
     * nothing on purpose: a Capacitor plugin is a Proxy, and resolving a promise with one calls its `.then`, which
     * throws - use the imported YandexAds directly after awaiting this.
     * @returns {Promise<void>}
     */
    initAds() {
        if (!this.adsInit) {
            this.adsInit = (async () => {
                await YandexAds.setUserConsent({ value: true });
                await YandexAds.initialize();
                YandexAds.addListener("interstitialAdShown", () => this.app.sound.setMuted(true));
                YandexAds.addListener("interstitialAdDismissed", () => this.finishInterstitial(true));
                YandexAds.addListener("interstitialAdFailedToShow", () => this.finishInterstitial(false));
                this.loadInterstitial();
            })();
            this.adsInit.catch(() => {
                this.adsInit = null;
            });
        }
        return this.adsInit;
    }

    loadInterstitial() {
        this.interstitialReady = false;
        YandexAds.loadInterstitial({ adUnitId: INTERSTITIAL_ID })
            .then(() => {
                this.interstitialReady = true;
            })
            .catch(() => {
                // offline / no fill - the next trigger just retries
            });
    }

    finishInterstitial(wasShown) {
        this.app.sound.setMuted(false);
        this.loadInterstitial();
        const done = this.onInterstitialDone;
        this.onInterstitialDone = null;
        done?.(wasShown);
    }

    async onGameReady() {
        if (this.adsDisabled) {
            return;
        }
        try {
            await this.initAds();
            // Top, like the VK banner: the bottom edge holds the mobile building toolbar.
            if (!this.bannerLoaded) {
                await YandexAds.loadBanner({ adUnitId: BANNER_ID, position: "top", overlap: false });
                this.bannerLoaded = true;
            }
            await YandexAds.showBanner();
        } catch (ex) {
            logger.error("Banner failed:", ex);
        }
    }

    async showInterstitialAd() {
        if (this.adsDisabled) {
            return false;
        }
        try {
            await this.initAds();
            if (!this.interstitialReady) {
                return false;
            }
            this.interstitialReady = false;
            return await new Promise(resolve => {
                this.onInterstitialDone = resolve;
                YandexAds.showInterstitial().catch(ex => {
                    logger.error("Interstitial failed to show:", ex);
                    this.finishInterstitial(false);
                });
            });
        } catch (ex) {
            logger.error("Interstitial failed:", ex);
            return false;
        }
    }

    getSupportsRewardedAds() {
        return true;
    }

    async showRewardedAd() {
        try {
            await this.initAds();
            await YandexAds.loadRewardedVideo({ adUnitId: REWARDED_ID });
            return await new Promise(resolve => {
                let rewarded = false;
                const handles = [
                    YandexAds.addListener("rewardedVideoAdShown", () => this.app.sound.setMuted(true)),
                    YandexAds.addListener("rewardedVideoAdRewarded", () => {
                        rewarded = true;
                    }),
                    YandexAds.addListener("rewardedVideoAdDismissed", () => end()),
                    YandexAds.addListener("rewardedVideoAdFailedToShow", () => end()),
                ];
                const end = () => {
                    this.app.sound.setMuted(false);
                    handles.forEach(h => h.then(x => x.remove()));
                    resolve(rewarded);
                };
                YandexAds.showRewardedVideo().catch(ex => {
                    logger.error("Rewarded ad failed to show:", ex);
                    end();
                });
            });
        } catch (ex) {
            logger.error("Rewarded ad failed:", ex);
            this.app.sound.setMuted(false);
            return false;
        }
    }

    // --- Purchases (RuStore Pay) ---

    getSupportsAdRemovalPurchase() {
        return true;
    }

    getAdsDisabled() {
        return this.adsDisabled;
    }

    async purchaseAdRemoval() {
        try {
            await RuStorePay.purchase({ productId: DISABLE_ADS_PRODUCT_ID });
            this.adsDisabled = true;
            this.storeAdsDisabled();
            this.initAds()
                .then(() => YandexAds.hideBanner())
                .catch(ex => logger.error("Banner hide failed:", ex));
            return true;
        } catch (ex) {
            logger.error("Ad-removal purchase failed:", ex);
            return false;
        }
    }

    getSupportsCurrencyPackPurchase() {
        return true;
    }

    /**
     * Buys and acknowledges the consumable pack (unacknowledged = RuStore refuses a repeat purchase). Crediting
     * the wallet is the caller's job, as on Yandex; if the acknowledge fails the pack is credited once more by
     * consumeUnprocessedPurchases() next launch - a rare bonus for the player rather than a lost purchase.
     */
    async purchaseCurrencyPack() {
        try {
            const { purchaseId } = await RuStorePay.purchase({ productId: CURRENCY_PACK_PRODUCT_ID });
            await RuStorePay.acknowledge({ purchaseId }).catch(ex =>
                logger.error("Currency pack acknowledge failed, will retry next launch:", ex)
            );
            return true;
        } catch (ex) {
            logger.error("Currency pack purchase failed:", ex);
            return false;
        }
    }
}
