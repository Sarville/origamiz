/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { IS_MOBILE, globalConfig } from "../core/config";
import { Logger } from "../core/logging";
import { clamp } from "../core/utils";

const logger = new Logger("browser-wrapper");

export class PlatformWrapperImplBrowser {
    constructor(app) {
        /** @type {Application} */
        this.app = app;

        // Dev-only fake purchase state for debug.rewardedAdsInstant - see
        // getSupportsAdRemovalPurchase()/getAdsDisabled()/purchaseAdRemoval().
        this.devAdsDisabled = false;
    }

    initialize() {
        document.documentElement.classList.add("p-" + this.getId());
        return Promise.resolve();
    }

    getId() {
        return "browser";
    }

    getSupportsRestart() {
        return true;
    }

    /**
     * Attempt to open an external url
     * @param {string} url
     */
    openExternalLink(url) {
        logger.log(this, "Opening external:", url);
        window.open(url, "_blank");
    }

    /**
     * Returns the strength of touch pans with the mouse
     */
    getTouchPanStrength() {
        return 1;
    }

    /**
     * Attempt to restart the app
     */
    performRestart() {
        logger.log(this, "Performing restart");
        window.location.reload();
    }

    /**
     * Returns the UI scale, called on every resize
     * @returns {number} */
    getUiScale() {
        if (IS_MOBILE) {
            return 1;
        }

        const avgDims = Math.min(this.app.screenWidth, this.app.screenHeight);
        return clamp((avgDims / 1000.0) * 1.9, 0.1, 10);
    }

    /**
     * Returns whether this platform supports a toggleable fullscreen
     */
    getSupportsFullscreen() {
        return Boolean(document.documentElement.requestFullscreen);
    }

    /**
     * Should set the apps fullscreen state to the desired state
     * @param {boolean} flag
     */
    setFullscreen(flag) {
        // Browsers only grant fullscreen from a user gesture (e.g. a click), so this
        // silently fails when called on boot to restore a saved fullscreen setting.
        const promise = flag ? document.documentElement.requestFullscreen?.() : document.exitFullscreen?.();
        promise?.catch(() => {});
    }

    getSupportsAppExit() {
        return false;
    }

    /**
     * Attempts to quit the app
     */
    exitApp() {
        // Not supported in the browser
    }

    /**
     * Whether this platform supports a keyboard
     */
    getSupportsKeyboard() {
        return !IS_MOBILE;
    }

    /**
     * Should return the minimum supported zoom level
     * @returns {number}
     */
    getMinimumZoom() {
        return 0.1 * this.getScreenScale();
    }

    /**
     * Should return the maximum supported zoom level
     * @returns {number}
     */
    getMaximumZoom() {
        return 3.5 * this.getScreenScale();
    }

    getScreenScale() {
        return Math.min(window.innerWidth, window.innerHeight) / 1024.0;
    }

    /**
     * Returns a platform-provided language code to prefer over the browser's
     * own language list, or null if there is none.
     * @returns {string | null}
     */
    getPreferredLanguage() {
        return null;
    }

    /**
     * Called once the game is playable (no loading screens left)
     */
    onGameReady() {}

    /**
     * Called when active gameplay begins/resumes (entering a level, closing menus, tab refocus)
     */
    onGameplayStart() {}

    /**
     * Called when active gameplay pauses/ends (opening menus, tab blur)
     */
    onGameplayStop() {}

    /**
     * Fetches small account-wide progress data (e.g. achievements) from the
     * platform's cloud storage. Returns null where unsupported.
     * @returns {Promise<Record<string, unknown> | null>}
     */
    async getCloudData() {
        return null;
    }

    /**
     * Best-effort push of small account-wide progress data to the platform's
     * cloud storage. No-op where unsupported.
     * @param {Record<string, unknown>} data
     */
    async setCloudData(data) {}

    /**
     * Whether this platform can show rewarded video ads at all - gates
     * whether the Shop even offers the "watch ad for currency" button.
     * Outside Yandex there's no real ad SDK to show, but dev builds can
     * fake support via config.local.js's debug.rewardedAdsInstant to test
     * the button/cooldown UI without deploying anywhere.
     */
    getSupportsRewardedAds() {
        return Boolean(G_IS_DEV && globalConfig.debug.rewardedAdsInstant);
    }

    /**
     * Shows a rewarded video ad. Resolves true only if the player watched it
     * through to the platform's reward trigger and should be granted the
     * reward, false otherwise (closed early, failed, or unsupported here).
     * @returns {Promise<boolean>}
     */
    async showRewardedAd() {
        return this.getSupportsRewardedAds();
    }

    /**
     * Whether this platform sells a real-money ad-removal purchase - gates
     * whether the Shop offers the "remove ads" button at all. Outside
     * Yandex there's no real payment SDK, but dev builds can fake it via
     * the same debug.rewardedAdsInstant flag used for rewarded ads, to
     * test the button/flow without deploying anywhere.
     */
    getSupportsAdRemovalPurchase() {
        return Boolean(G_IS_DEV && globalConfig.debug.rewardedAdsInstant);
    }

    /**
     * Whether the player already owns the ad-removal purchase (checked once
     * at startup - see initialize()). Every banner/interstitial call site
     * must check this before showing anything.
     */
    getAdsDisabled() {
        return this.devAdsDisabled;
    }

    /**
     * Starts the ad-removal purchase flow. Resolves true if the purchase
     * succeeded and ads are now disabled, false otherwise (cancelled,
     * failed, or unsupported here).
     * @returns {Promise<boolean>}
     */
    async purchaseAdRemoval() {
        if (!this.getSupportsAdRemovalPurchase()) {
            return false;
        }
        this.devAdsDisabled = true;
        return true;
    }

    /**
     * Shows a fullscreen interstitial ad. Resolves true if an ad was
     * actually shown, false otherwise (throttled by the platform, ads
     * disabled, or unsupported here). Never call this while the player is
     * mid-interaction (dragging, typing, placing a blueprint) - that's the
     * caller's responsibility, not this method's.
     * @returns {Promise<boolean>}
     */
    async showInterstitialAd() {
        return false;
    }
}
