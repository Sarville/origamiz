/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { IS_MOBILE } from "../core/config";
import { Logger } from "../core/logging";
import { clamp } from "../core/utils";

const logger = new Logger("browser-wrapper");

export class PlatformWrapperImplBrowser {
    constructor(app) {
        /** @type {Application} */
        this.app = app;
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
}
