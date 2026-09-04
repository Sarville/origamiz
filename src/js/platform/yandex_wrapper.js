/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { Logger } from "../core/logging";
import { PlatformWrapperImplBrowser } from "./wrapper";

const logger = new Logger("yandex-wrapper");

// Loaded onto window by the SDK <script> tag the "yandex" build variant
// injects into index.html (see gulp/html.js) - not present in other builds.
/** @typedef {{ init: () => Promise<any> }} YaGamesGlobal */

export class PlatformWrapperImplYandex extends PlatformWrapperImplBrowser {
    /** @param {Application} app */
    constructor(app) {
        super(app);
        this.ysdk = null;
        this.player = null;
        this.payments = null;
        this.adsDisabled = false;

        // Serializes setCloudData calls so each one's read-modify-write
        // (see setCloudData) can't race a concurrent one and clobber it -
        // e.g. an achievement unlocking the same tick a wallet credit
        // flushes.
        this.cloudWriteQueue = Promise.resolve();
    }

    async initialize() {
        await super.initialize();
        try {
            // @ts-ignore - YaGames is a global injected by the SDK script tag
            this.ysdk = await YaGames.init();
            this.player = await this.ysdk.getPlayer();
        } catch (ex) {
            logger.error("Failed to initialize Yandex Games SDK, continuing without it:", ex);
        }

        try {
            this.payments = (await this.ysdk?.getPayments({ signed: false })) ?? null;
            const purchases = await this.payments?.getPurchases();
            this.adsDisabled = Boolean(purchases?.some(purchase => purchase.productID === "disable_ads"));
        } catch (ex) {
            logger.error("Failed to check Yandex ad-removal purchase, continuing without it:", ex);
        }
    }

    getId() {
        return "yandex";
    }

    getPreferredLanguage() {
        return this.ysdk?.environment?.i18n?.lang ?? null;
    }

    getSupportsAuth() {
        return Boolean(this.ysdk);
    }

    isAuthorized() {
        return this.player?.isAuthorized() ?? false;
    }

    /**
     * Opens the Yandex sign-in dialog and, on success, re-fetches the
     * Player object bound to the now-authorized identity (per Yandex's own
     * docs - the pre-auth Player instance doesn't update itself in place).
     * @returns {Promise<boolean>}
     */
    async requestAuth() {
        if (!this.ysdk) {
            return false;
        }
        try {
            await this.ysdk.auth.openAuthDialog();
            this.player = await this.ysdk.getPlayer();
        } catch (ex) {
            logger.error("Yandex auth failed:", ex);
        }
        return this.isAuthorized();
    }

    onGameReady() {
        this.ysdk?.features?.LoadingAPI?.ready();
        if (!this.adsDisabled) {
            this.ysdk?.adv?.showBannerAdv();
        }
    }

    onGameplayStart() {
        this.ysdk?.features?.GameplayAPI?.start();
    }

    onGameplayStop() {
        this.ysdk?.features?.GameplayAPI?.stop();
    }

    async getCloudData() {
        try {
            return (await this.player?.getData()) ?? null;
        } catch (ex) {
            logger.error("Failed to read Yandex cloud player data:", ex);
            return null;
        }
    }

    /**
     * Merges `patch` into the player's cloud data instead of replacing it
     * wholesale - Yandex's own docs never actually specify whether setData
     * replaces the whole document or merges by key, so every write here
     * reads the current document first and writes the full merged result
     * back, which is correct either way. This is what lets independent
     * features (achievements, the wallet) each own their own top-level key
     * of the same document without a later write from one clobbering an
     * earlier one from the other - see cloudWriteQueue for how concurrent
     * calls are kept from racing each other's read-modify-write.
     * @param {Record<string, unknown>} patch
     */
    async setCloudData(patch) {
        this.cloudWriteQueue = this.cloudWriteQueue.then(async () => {
            try {
                const current = (await this.player?.getData()) ?? {};
                await this.player?.setData({ ...current, ...patch }, true);
            } catch (ex) {
                logger.error("Failed to write Yandex cloud player data:", ex);
            }
        });
        return this.cloudWriteQueue;
    }

    getSupportsRewardedAds() {
        return Boolean(this.ysdk?.adv?.showRewardedVideo);
    }

    async showRewardedAd() {
        if (!this.getSupportsRewardedAds()) {
            return false;
        }
        return new Promise(resolve => {
            let rewarded = false;
            this.ysdk.adv.showRewardedVideo({
                callbacks: {
                    onRewarded: () => {
                        rewarded = true;
                    },
                    onClose: () => resolve(rewarded),
                    onError: ex => {
                        logger.error("Rewarded ad failed:", ex);
                        resolve(false);
                    },
                },
            });
        });
    }

    getSupportsAdRemovalPurchase() {
        return Boolean(this.payments);
    }

    getAdsDisabled() {
        return this.adsDisabled;
    }

    async purchaseAdRemoval() {
        if (!this.payments) {
            return false;
        }
        try {
            await this.payments.purchase({ id: "disable_ads" });
            this.adsDisabled = true;
            this.ysdk?.adv?.hideBannerAdv();
            return true;
        } catch (ex) {
            logger.error("Ad-removal purchase failed:", ex);
            return false;
        }
    }

    async showInterstitialAd() {
        if (this.adsDisabled || !this.ysdk?.adv?.showFullscreenAdv) {
            return false;
        }
        return new Promise(resolve => {
            this.ysdk.adv.showFullscreenAdv({
                callbacks: {
                    onClose: wasShown => resolve(Boolean(wasShown)),
                    onError: ex => {
                        logger.error("Interstitial ad failed:", ex);
                        resolve(false);
                    },
                },
            });
        });
    }
}
