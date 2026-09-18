import { BaseHUDPart } from "../base_hud_part";

// Minimum real-world time between two interstitial attempts - VK/OK rule
// 5.1.5.2 forbids showing them more than once per 30s "between screens";
// Yandex has no such cap, but there's no reason to run it on a separate,
// looser schedule.
const INTERSTITIAL_COOLDOWN_SECONDS = 5 * 60;

// No interstitial within this long after app launch, even if a trigger
// fires immediately - VK rule 5.1.5.2 forbids showing one at launch.
const INTERSTITIAL_LAUNCH_GRACE_SECONDS = 60;

/**
 * Shows a fullscreen interstitial ad, but only right at a genuine screen
 * transition: the level-up dialog closing, or the settings menu closing.
 * Never mid-gameplay - VK/OK rule 5.1.5.2 only allows interstitials
 * "between screens" (e.g. a level-load transition), not as an unprompted
 * mid-session interrupt. Purely a scheduler with no UI of its own - see
 * PlatformWrapperImplYandex/PlatformWrapperImplVk.showInterstitialAd() for
 * the actual ad call, which already no-ops by itself once ads are
 * purchased away.
 */
export class HUDInterstitialAds extends BaseHUDPart {
    createElements() {}

    initialize() {
        this.nextAttemptAt = this.root.time.realtimeNow() + INTERSTITIAL_LAUNCH_GRACE_SECONDS;
        this.showing = false;

        this.root.hud.signals.unlockNotificationFinished.add(this.tryShow, this);
        this.root.hud.signals.settingsMenuClosed.add(this.tryShow, this);
    }

    tryShow() {
        if (this.showing || this.root.time.realtimeNow() < this.nextAttemptAt) {
            return;
        }

        this.showing = true;
        this.root.app.platformWrapper.showInterstitialAd().then(() => {
            this.showing = false;
            this.nextAttemptAt = this.root.time.realtimeNow() + INTERSTITIAL_COOLDOWN_SECONDS;
        });
    }
}
