import { BaseHUDPart } from "../base_hud_part";

// Minimum real-world time between two interstitial attempts, and how long to
// wait after entering a level before the very first one - keeps it from
// ambushing the player right after loading in.
const INTERSTITIAL_COOLDOWN_SECONDS = 4 * 60;
const INTERSTITIAL_GRACE_PERIOD_SECONDS = 90;

/**
 * Periodically shows a fullscreen interstitial ad, but only when it's safe
 * to interrupt: no dialog or text input open, and the player isn't
 * mid-drag (building/belt placement, blueprint placement, mass-select).
 * Purely a scheduler with no UI of its own - see
 * PlatformWrapperImplYandex.showInterstitialAd() for the actual ad call,
 * which already no-ops by itself once ads are purchased away.
 */
export class HUDInterstitialAds extends BaseHUDPart {
    createElements() {}

    initialize() {
        this.nextAttemptAt = this.root.time.realtimeNow() + INTERSTITIAL_GRACE_PERIOD_SECONDS;
        this.showing = false;
    }

    update() {
        if (
            this.showing ||
            this.root.time.realtimeNow() < this.nextAttemptAt ||
            !this.isSafeToInterrupt()
        ) {
            return;
        }

        this.showing = true;
        this.root.app.platformWrapper.showInterstitialAd().then(() => {
            this.showing = false;
            this.nextAttemptAt = this.root.time.realtimeNow() + INTERSTITIAL_COOLDOWN_SECONDS;
        });
    }

    /**
     * @returns {boolean}
     */
    isSafeToInterrupt() {
        const hud = this.root.hud;
        return (
            !hud.hasBlockingOverlayOpen() &&
            !hud.parts.buildingPlacer.currentlyDragging &&
            !hud.parts.blueprintPlacer.currentBlueprint.get() &&
            !hud.parts.massSelector.currentSelectionStartWorld
        );
    }
}
