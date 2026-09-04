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

    async initialize() {
        await this.readAsync();
        await this.syncWithCloud();
    }

    /**
     * Merges local unlocks with the platform's cloud copy (if any), so an
     * achievement unlocked on either side ends up unlocked on both. This is
     * also what keeps progress alive on iOS, where WebKit can evict this
     * game's IndexedDB storage (it runs third-party/iframed on Yandex
     * Games) independently of any local save.
     */
    async syncWithCloud() {
        const cloud = await this.app.platformWrapper.getCloudData();
        const remoteUnlocked = Array.isArray(cloud?.unlocked) ? cloud.unlocked : [];
        const localUnlocked = this.currentData.unlocked;

        const merged = Array.from(new Set([...localUnlocked, ...remoteUnlocked]));

        if (merged.length !== localUnlocked.length) {
            this.currentData.unlocked = merged;
            await this.writeAsync();
        }
        if (merged.length !== remoteUnlocked.length) {
            await this.app.platformWrapper.setCloudData({ unlocked: merged });
        }
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
        this.app.platformWrapper.setCloudData({ unlocked: this.currentData.unlocked });
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
