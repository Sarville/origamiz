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

    async setCloudData(data) {
        try {
            await this.player?.setData(data, true);
        } catch (ex) {
            logger.error("Failed to write Yandex cloud player data:", ex);
        }
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
