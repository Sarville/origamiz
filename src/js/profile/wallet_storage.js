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

// How often the heartbeat re-writes the wallet to the cloud - both to
// persist balance changes and to keep this session's lock claim fresh (see
// class doc). Also the practical write rate: one setData call per tick,
// comfortably under Yandex's 100-calls/5min player-data limit.
const HEARTBEAT_INTERVAL_MS = 20 * 1000;

// A foreign session's lock claim older than this is considered abandoned
// (tab closed/crashed) and can be taken over.
const SESSION_LOCK_STALE_MS = 90 * 1000;

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
 * A session that finds a *different*, still-fresh claim on load or on a
 * heartbeat backs off (this.locked = true) and refuses to earn or spend
 * currency until either that claim goes stale (SESSION_LOCK_STALE_MS with
 * no heartbeat - the other tab closed) or this tab reloads and finds it
 * gone. This is a heuristic, not a hard guarantee: two tabs opened within
 * the same instant could both see no claim and both believe they won it.
 */
export class WalletStorage {
    /** @param {Application} app */
    constructor(app) {
        this.app = app;

        this.balance = 0;
        this.dailyBonusClaimedAt = 0;
        this.adRewardClaimedAt = 0;

        /** Whether another, still-active session currently holds the lock. */
        this.locked = false;

        /**
         * Whether *this* session currently owns the lock uninterrupted -
         * false right after boot and again any time locked flips true, so
         * the next successful claim knows to adopt the cloud's balance
         * instead of overwriting it with this tab's possibly-stale copy
         * (see claimOrRefresh).
         */
        this.owned = false;

        this.sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        this.heartbeatTimer = null;
    }

    async initialize() {
        await this.claimOrRefresh();
        this.heartbeatTimer = setInterval(() => this.claimOrRefresh(), HEARTBEAT_INTERVAL_MS);

        // Best-effort final write - not guaranteed to complete, but costs
        // nothing to attempt.
        window.addEventListener("pagehide", () => this.claimOrRefresh());
    }

    serialize() {
        return {
            balance: this.balance,
            dailyBonusClaimedAt: this.dailyBonusClaimedAt,
            adRewardClaimedAt: this.adRewardClaimedAt,
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
        const cloud = await this.app.platformWrapper.getCloudData();
        const wallet = cloud?.wallet;
        const session = wallet?.session;
        const foreignSessionActive =
            session && session.id !== this.sessionId && Date.now() - session.updatedAt < SESSION_LOCK_STALE_MS;

        if (foreignSessionActive) {
            // Someone else holds the lock - freeze in place (canEarn/
            // canSpend both check !locked) without touching our own
            // balance, so nothing here gets stomped once we win it back.
            this.locked = true;
            this.owned = false;
            return;
        }

        if (!this.owned && wallet && typeof wallet === "object") {
            // First claim this session, or reclaiming after a foreign
            // session's lock went stale - adopt its last known state
            // instead of overwriting it with our own (possibly older) copy.
            this.balance = Number(wallet.balance) || 0;
            this.dailyBonusClaimedAt = Number(wallet.dailyBonusClaimedAt) || 0;
            this.adRewardClaimedAt = Number(wallet.adRewardClaimedAt) || 0;
        }

        this.locked = false;
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
    }

    /** @param {number} amount */
    debit(amount) {
        assert(this.canSpend(amount), "Can not afford wallet debit: " + amount);
        this.balance -= amount;
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
}
