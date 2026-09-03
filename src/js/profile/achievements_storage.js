/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { ExplainedResult } from "../core/explained_result";
import { ReadWriteProxy } from "../core/read_write_proxy";

/**
 * Persists which achievements have been unlocked. Lives outside any savegame -
 * once unlocked, an achievement stays unlocked forever, the same way Steam
 * achievements do, regardless of which savegame it happened in.
 */
class AchievementsStorageData {
    constructor() {
        /** @type {Array<string>} */
        this.unlocked = [];
    }
}

export class AchievementsStorage extends ReadWriteProxy {
    /**
     * @param {Application} app
     * @param {import("../platform/storage").Storage} storage
     */
    constructor(app, storage) {
        super(storage, "achievements.bin");
        this.app = app;
    }

    initialize() {
        return this.readAsync();
    }

    /**
     * @param {string} id
     * @returns {boolean}
     */
    isUnlocked(id) {
        return this.currentData.unlocked.includes(id);
    }

    /**
     * Marks an achievement as unlocked, if it isn't already.
     * @param {string} id
     * @returns {boolean} Whether it just got unlocked (false if already unlocked before)
     */
    unlock(id) {
        if (this.isUnlocked(id)) {
            return false;
        }
        this.currentData.unlocked.push(id);
        this.writeAsync();
        return true;
    }

    // RW Proxy impl

    verify(data) {
        if (!Array.isArray(data.unlocked)) {
            return ExplainedResult.bad("missing key 'unlocked'");
        }
        return ExplainedResult.good();
    }

    getDefaultData() {
        return {
            version: this.getCurrentVersion(),
            unlocked: [],
        };
    }

    getCurrentVersion() {
        return 1;
    }

    migrate(data) {
        return ExplainedResult.good();
    }
}
