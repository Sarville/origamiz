/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { Logger } from "../core/logging";

const logger = new Logger("wallet");

// Bonus claim timestamps and the wallet balance itself are only meaningful
// account-wide (see the class doc), so both live here now instead of in
// HubGoals/the savegame.
const DAILY_BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AD_REWARD_INTERVAL_MS = 2 * 60 * 60 * 1000;

// Rewarded-ad speed boost. Each watched ad: x2 speed for BOOST_DURATION_MS, a
// BOOST_COOLDOWN_MS lockout, and a permanent +0.1% (stored as integer permille
// so 3000 additions never drift) up to +300%, at most BOOST_DAILY_LIMIT
// watches per local calendar day (= max +10%/day).
export const BOOST_DURATION_MS = 3 * 60 * 1000;
export const BOOST_COOLDOWN_MS = 5 * 60 * 1000;
export const BOOST_RETRY_MS = 30 * 1000;
export const BOOST_DAILY_LIMIT = 100;
export const BOOST_MAX_PERMILLE = 3000;
const BOOST_TEMP_MULTIPLIER = 2;

/** @returns {string} Local calendar day key, e.g. "2026-10-1" */
function localDayKey() {
    const d = new Date(Date.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

// How often the heartbeat re-writes the wallet to the cloud - both to
// persist balance changes and to keep this session's lock claim fresh (see
// class doc). Also the practical write rate: one setData call per tick,
// comfortably under Yandex's 100-calls/5min player-data limit.
const HEARTBEAT_INTERVAL_MS = 20 * 1000;

// Balance changes are pushed to the cloud this long after the first one in a
// burst (shape deliveries credit one at a time), on top of the heartbeat.
// Worst case ~12 + 3 writes/min stays under Yandex's 100-calls/5min limit.
const FLUSH_DELAY_MS = 5 * 1000;

const SESSION_ID_KEY = "origamiz_wallet_session";

/**
 * Persisted per browser tab so a page reload keeps owning its own claim
 * instead of looking like a foreign session.
 * @returns {string}
 */
function loadSessionId() {
    const fresh = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    try {
        const saved = sessionStorage.getItem(SESSION_ID_KEY);
        if (saved) {
            return saved;
        }
        sessionStorage.setItem(SESSION_ID_KEY, fresh);
    } catch (ex) {
        // sessionStorage blocked - a reload then just takes the claim over like any new session
    }
    return fresh;
}

/**
 * Global (account-wide, not per-savegame) currency wallet, plus the two
 * once-a-real-day bonus claims that feed it (Shop daily bonus, rewarded-ad
 * bonus) - see the user-facing requirement this was built for: currency
 * must survive across savegames and can't just live in a locally editable
 * save file.
 *
 * Deliberately NOT persisted through the local Storage/ReadWriteProxy the
 * way savegames and achievements are - it exists only in memory for the
 * life of this tab, hydrated from and pushed to the platform's cloud player
 * data (platformWrapper.getCloudData/setCloudData, backed by Yandex's
 * per-player getData/setData - works for anonymous sessions too, not just
 * signed-in ones). A player can't inflate their balance by editing the
 * game's own IndexedDB in devtools, because the balance was never written
 * there in the first place. This is a best-effort mitigation, not a real
 * security boundary - there is no backend validating any of this, so a
 * determined attacker can still tamper with the running page itself (e.g.
 * overwrite this object from the console). On platforms/builds without a
 * real cloud store (dev browser without the Yandex SDK), the wallet simply
 * doesn't persist across reloads - an accepted tradeoff for the same reason.
 *
 * Cross-device session lock: since there's no server to arbitrate, "only
 * one active session" is approximated by writing a {id, updatedAt} claim
 * into the same cloud blob and heartbeating it every HEARTBEAT_INTERVAL_MS.
 * The newest session always wins: a session that boots adopts the cloud
 * wallet and overwrites the claim immediately (no waiting for the old one
 * to time out). The previous owner notices on its next heartbeat that the
 * claim carries a different id, stops writing (locked = true), saves the
 * game and goes to the main menu, where the player can reload to take the
 * wallet back. A tab closing releases its claim (see release). This is a
 * heuristic, not a hard guarantee: two sessions booting within the same
 * instant can both believe they won - the later cloud write then evicts the
 * other one at its next heartbeat.
 */
export class WalletStorage {
    /** @param {Application} app */
    constructor(app) {
        this.app = app;

        this.balance = 0;
        this.dailyBonusClaimedAt = 0;
        this.adRewardClaimedAt = 0;

        this.boostPermille = 0;
        this.boostActiveUntil = 0;
        this.boostCooldownUntil = 0;
        this.boostDayKey = "";
        this.boostDayCount = 0;
        /** Not persisted: short lockout after a failed ad request. */
        this.boostRetryUntil = 0;

        /** Whether a newer session took the wallet over - permanent until the page reloads. */
        this.locked = false;
        this.kickNoticeShown = false;

        /**
         * Whether *this* session has claimed the wallet - false right
         * after boot so the first claim adopts the cloud's balance instead
         * of overwriting it with this tab's empty copy (see claimOrRefresh).
         */
        this.owned = false;

        this.sessionId = loadSessionId();
        this.heartbeatTimer = null;
        this.flushTimer = null;
    }

    async initialize() {
        await this.claimOrRefresh();
        this.heartbeatTimer = setInterval(() => this.claimOrRefresh(), HEARTBEAT_INTERVAL_MS);

        window.addEventListener("pagehide", () => this.release());
    }

    /**
     * Best-effort final write on tab close: persists the state and drops the
     * claim so the next session doesn't have to take over from a dead one.
     */
    release() {
        if (!this.owned || this.locked) {
            return;
        }
        this.app.platformWrapper.setCloudData({ wallet: { ...this.serialize(), session: null } });
    }

    /** Schedules a cloud write soon, instead of waiting for the next heartbeat. */
    markDirty() {
        if (this.flushTimer || this.locked || !this.owned) {
            return;
        }
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.claimOrRefresh();
        }, FLUSH_DELAY_MS);
    }

    /** Called when the cloud claim belongs to a newer session. */
    handleSuperseded() {
        this.locked = true;
        this.owned = false;
        clearInterval(this.heartbeatTimer);
        clearTimeout(this.flushTimer);
        this.flushTimer = null;

        const state = this.app.stateMgr.getCurrentState();
        if (typeof state?.goBackToMenu === "function") {
            // The main menu shows the notice on enter.
            state.goBackToMenu();
        } else if (typeof state?.showWalletKickedDialog === "function") {
            state.showWalletKickedDialog();
        }
    }

    serialize() {
        return {
            balance: this.balance,
            dailyBonusClaimedAt: this.dailyBonusClaimedAt,
            adRewardClaimedAt: this.adRewardClaimedAt,
            boostPermille: this.boostPermille,
            boostActiveUntil: this.boostActiveUntil,
            boostCooldownUntil: this.boostCooldownUntil,
            boostDayKey: this.boostDayKey,
            boostDayCount: this.boostDayCount,
            session: { id: this.sessionId, updatedAt: Date.now() },
        };
    }

    /**
     * Re-reads the cloud wallet, decides whether this session still (or
     * now) owns the lock, and if so writes the current in-memory state back
     * with a fresh heartbeat. Used both for the initial claim and every
     * heartbeat tick after that - see class doc.
     */
    async claimOrRefresh() {
        if (this.locked) {
            return;
        }
        const cloud = await this.app.platformWrapper.getCloudData();
        const wallet = cloud?.wallet;
        const session = wallet?.session;

        // Only a real, shared-across-devices cloud store can have a genuine
        // "foreign" session - the plain browser platform's getCloudData is
        // just this device's own local storage (see its class doc).
        if (
            this.owned &&
            this.app.platformWrapper.getSupportsCrossDeviceWallet() &&
            session &&
            session.id !== this.sessionId
        ) {
            this.handleSuperseded();
            return;
        }

        if (!this.owned && wallet && typeof wallet === "object") {
            // First claim of this session - adopt the cloud's last known
            // state instead of overwriting it with our empty copy.
            this.balance = Number(wallet.balance) || 0;
            this.dailyBonusClaimedAt = Number(wallet.dailyBonusClaimedAt) || 0;
            this.adRewardClaimedAt = Number(wallet.adRewardClaimedAt) || 0;
            this.boostPermille = Math.min(BOOST_MAX_PERMILLE, Math.max(0, Number(wallet.boostPermille) || 0));
            this.boostActiveUntil = Number(wallet.boostActiveUntil) || 0;
            this.boostCooldownUntil = Number(wallet.boostCooldownUntil) || 0;
            this.boostDayKey = String(wallet.boostDayKey || "");
            this.boostDayCount = Number(wallet.boostDayCount) || 0;
        }

        this.owned = true;
        try {
            await this.app.platformWrapper.setCloudData({ wallet: this.serialize() });
        } catch (ex) {
            logger.error("Failed to push wallet to cloud:", ex);
        }
    }

    /** @returns {boolean} Whether wallet-earning actions are allowed right now. */
    canEarn() {
        return !this.locked;
    }

    /**
     * @param {number} amount
     * @returns {boolean} Whether a spend of this size is allowed right now.
     */
    canSpend(amount) {
        return !this.locked && this.balance >= amount;
    }

    /** @param {number} amount */
    credit(amount) {
        assert(amount >= 0, "Wallet credit must be >= 0: " + amount);
        this.balance += amount;
        this.markDirty();
    }

    /** @param {number} amount */
    debit(amount) {
        assert(this.canSpend(amount), "Can not afford wallet debit: " + amount);
        this.balance -= amount;
        this.markDirty();
    }

    /** @returns {boolean} */
    canClaimDailyBonus() {
        return this.canEarn() && Date.now() - this.dailyBonusClaimedAt >= DAILY_BONUS_INTERVAL_MS;
    }

    /**
     * @param {number} amount
     * @returns {boolean}
     */
    tryClaimDailyBonus(amount) {
        if (!this.canClaimDailyBonus()) {
            return false;
        }
        this.dailyBonusClaimedAt = Date.now();
        this.credit(amount);
        return true;
    }

    /** @returns {boolean} */
    canClaimAdReward() {
        return this.canEarn() && Date.now() - this.adRewardClaimedAt >= AD_REWARD_INTERVAL_MS;
    }

    /** @returns {number} Seconds left until the next rewarded-ad claim, 0 if claimable right now. */
    getAdRewardCooldownSeconds() {
        return Math.max(0, AD_REWARD_INTERVAL_MS - (Date.now() - this.adRewardClaimedAt)) / 1000;
    }

    /**
     * Grants the rewarded-ad currency claim. Call only after the platform
     * confirmed the ad was actually watched.
     * @param {number} amount
     * @returns {boolean}
     */
    grantAdReward(amount) {
        if (!this.canClaimAdReward()) {
            return false;
        }
        this.adRewardClaimedAt = Date.now();
        this.credit(amount);
        return true;
    }

    // --- Rewarded-ad speed boost ---

    /** @returns {number} Permanent accumulated bonus as a fraction, 0..3 */
    getBoostBonus() {
        return this.boostPermille / 1000;
    }

    /**
     * Multiplier applied to belts, miners and processors on top of upgrades.
     * @returns {number}
     */
    getSpeedMultiplier() {
        const active = Date.now() < this.boostActiveUntil;
        return (1 + this.boostPermille / 1000) * (active ? BOOST_TEMP_MULTIPLIER : 1);
    }

    /** @returns {number} Seconds of the x2 boost left, 0 if inactive */
    getBoostRemainingSeconds() {
        return Math.max(0, this.boostActiveUntil - Date.now()) / 1000;
    }

    /** @returns {number} Seconds until the boost button is usable again (cooldown or failed-ad retry) */
    getBoostCooldownSeconds() {
        return Math.max(0, this.boostCooldownUntil - Date.now(), this.boostRetryUntil - Date.now()) / 1000;
    }

    /** @returns {number} Watches left today */
    getBoostDailyRemaining() {
        const used = this.boostDayKey === localDayKey() ? this.boostDayCount : 0;
        return Math.max(0, BOOST_DAILY_LIMIT - used);
    }

    /** @returns {boolean} */
    canStartBoost() {
        return this.canEarn() && this.getBoostCooldownSeconds() === 0 && this.getBoostDailyRemaining() > 0;
    }

    /**
     * Call only after the platform confirmed the ad was watched.
     * @returns {boolean}
     */
    grantBoost() {
        if (!this.canStartBoost()) {
            return false;
        }
        const now = Date.now();
        const today = localDayKey();
        this.boostDayCount = (this.boostDayKey === today ? this.boostDayCount : 0) + 1;
        this.boostDayKey = today;
        this.boostPermille = Math.min(BOOST_MAX_PERMILLE, this.boostPermille + 1);
        this.boostActiveUntil = now + BOOST_DURATION_MS;
        this.boostCooldownUntil = now + BOOST_COOLDOWN_MS;
        this.claimOrRefresh();
        return true;
    }

    /** Call when the ad could not be loaded/shown at all. */
    failBoostAttempt() {
        this.boostRetryUntil = Date.now() + BOOST_RETRY_MS;
    }
}
