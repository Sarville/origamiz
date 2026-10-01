import { formatBigNumber, makeDiv } from "../../../core/utils";
import { SOUNDS } from "../../../platform/sound";
import { enumRewardedAdResult } from "../../../platform/wrapper";
import { BOOST_COOLDOWN_MS, BOOST_DAILY_LIMIT, BOOST_DURATION_MS } from "../../../profile/wallet_storage";
import { T } from "../../../translations";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { enumNotificationType } from "./notifications";

/**
 * Rewarded-ad speed boost button under the game menu: a ring that counts down
 * the active x2 window, then counts the cooldown back up. Clicking opens a
 * confirm dialog; the state itself lives in WalletStorage.
 */
export class HUDSpeedBoost extends BaseHUDPart {
    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_SpeedBoost");
        this.label = makeDiv(this.element, null, ["label"]);
        this.button = makeDiv(this.element, null, ["boostButton"]);
        this.ring = makeDiv(this.button, null, ["ring"]);
        makeDiv(this.button, null, ["icon"]);
        this.trackClicks(this.button, this.onClick);
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.element);
        this.watching = false;
        this.lastState = "";
        this.lastLabel = null;
        this.lastProgress = -1;
    }

    get wallet() {
        return this.root.app.wallet;
    }

    update() {
        const supported = this.root.app.platformWrapper.getSupportsRewardedAds();
        this.domAttach.update(supported);
        if (!supported) {
            return;
        }

        const wallet = this.wallet;
        const active = wallet.getBoostRemainingSeconds();
        const cooldown = wallet.getBoostCooldownSeconds();

        let state = "ready";
        let progress = 1;
        let label = "";
        if (active > 0) {
            state = "active";
            progress = active / (BOOST_DURATION_MS / 1000);
            label = T.ingame.speedBoost.activeLabel.replace("<time>", formatClock(active));
        } else if (cooldown > 0) {
            state = "cooldown";
            progress = 1 - cooldown / Math.max(cooldown, BOOST_COOLDOWN_MS / 1000);
            label = formatClock(cooldown);
        } else if (!wallet.canStartBoost()) {
            state = "locked";
        }

        if (state !== this.lastState) {
            for (const name of ["ready", "active", "cooldown", "locked"]) {
                this.button.classList.toggle(name, name === state);
            }
            this.lastState = state;
        }
        if (label !== this.lastLabel) {
            this.label.innerText = label;
            this.label.classList.toggle("hidden", !label);
            this.lastLabel = label;
        }
        // Whole-percent steps are plenty for a 3rem ring.
        const progressPercent = Math.round(progress * 100);
        if (progressPercent !== this.lastProgress) {
            this.ring.style.setProperty("--progress", progressPercent + "%");
            this.lastProgress = progressPercent;
        }
    }

    onClick() {
        if (this.watching) {
            return;
        }
        const wallet = this.wallet;
        const t = T.ingame.speedBoost;
        const bonus = (wallet.getBoostBonus() * 100).toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
        const stats =
            t.statBonus.replace("<bonus>", bonus) +
            "<br>" +
            t.statDaily
                .replace("<left>", formatBigNumber(wallet.getBoostDailyRemaining()))
                .replace("<limit>", "" + BOOST_DAILY_LIMIT);

        if (wallet.canStartBoost()) {
            const signals = this.root.hud.parts.dialogs.showInfo(
                t.title,
                `${t.description}<br><br>${stats}`,
                ["abort:bad", "watch:good"]
            );
            signals.watch.add(this.watchAd, this);
            return;
        }

        let reason = t.reasonLocked;
        if (wallet.getBoostRemainingSeconds() > 0) {
            reason = t.reasonActive;
        } else if (wallet.getBoostCooldownSeconds() > 0) {
            reason = t.reasonCooldown.replace("<time>", formatClock(wallet.getBoostCooldownSeconds()));
        } else if (wallet.getBoostDailyRemaining() === 0) {
            reason = t.reasonDailyLimit;
        }
        this.root.hud.parts.dialogs.showInfo(t.title, `${reason}<br><br>${stats}`);
    }

    async watchAd() {
        if (this.watching || !this.wallet.canStartBoost()) {
            return;
        }
        this.watching = true;
        let result;
        try {
            result = await this.root.app.platformWrapper.showRewardedAd();
        } finally {
            this.watching = false;
        }

        if (result === enumRewardedAdResult.rewarded) {
            if (this.wallet.grantBoost()) {
                this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
                this.root.hud.signals.notification.dispatch(
                    T.ingame.speedBoost.granted,
                    enumNotificationType.success
                );
            }
        } else if (result === enumRewardedAdResult.unavailable) {
            this.wallet.failBoostAttempt();
            this.root.hud.signals.notification.dispatch(
                T.ingame.speedBoost.unavailable,
                enumNotificationType.warning
            );
        }
    }
}

/** @param {number} seconds */
function formatClock(seconds) {
    const total = Math.ceil(seconds);
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}
