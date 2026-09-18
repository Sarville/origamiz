/* typehints:start */
import { Application } from "@/application";
/* typehints:end */

import debounce from "debounce-promise";
import { globalConfig } from "../core/config";
import { ExplainedResult } from "../core/explained_result";
import { Logger } from "../core/logging";
import { ReadWriteProxy } from "../core/read_write_proxy";
import { Savegame } from "./savegame";
const logger = new Logger("savegame_manager");

/**
 * @typedef {import("./savegame_typedefs").SavegamesData} SavegamesData
 * @typedef {import("./savegame_typedefs").SavegameMetadata} SavegameMetadata
 */

/** @enum {string} */
export const enumLocalSavegameStatus = {
    offline: "offline",
    synced: "synced",
};

export class SavegameManager extends ReadWriteProxy {
    constructor(app, storage) {
        super(storage, "savegames.bin");

        /** @type {Application} */
        this.app = app;

        this.currentData = this.getDefaultData();

        // Collapses bursts of nearby writes (e.g. a content save immediately followed by a
        // metadata-only save) into a single cloud push - see writeAsync() below.
        this.pushSyncBundleDebounced = debounce(() => this.pushSyncBundle(), 500);
    }

    // RW Proxy Impl
    /**
     * @returns {SavegamesData}
     */
    getDefaultData() {
        return {
            version: this.getCurrentVersion(),
            savegames: [],
        };
    }

    getCurrentVersion() {
        return 1002;
    }

    verify(data) {
        // @TODO
        return ExplainedResult.good();
    }

    /**
     *
     * @param {SavegamesData} data
     */
    migrate(data) {
        if (data.version < 1001) {
            data.savegames.forEach(savegame => {
                savegame.level = 0;
            });
            data.version = 1001;
        }

        if (data.version < 1002) {
            data.savegames.forEach(savegame => {
                savegame.name = null;
            });
            data.version = 1002;
        }

        return ExplainedResult.good();
    }

    /**
     * Every path that changes a savegame or its metadata (create/import/delete, and a content
     * save via Savegame.writeSavegameAndMetadata) ends up calling this - the one choke point to
     * hook a cloud push onto, instead of adding a call at every call site individually.
     * @returns {Promise<void>}
     */
    writeAsync() {
        return super.writeAsync().then(result => {
            logger.log("Scheduling cloud savegame push");
            this.pushSyncBundleDebounced();
            return result;
        });
    }

    // End rw proxy

    /**
     * @returns {Array<SavegameMetadata>}
     */
    getSavegamesMetaData() {
        return this.currentData.savegames;
    }

    /**
     *
     * @param {string} internalId
     * @returns {Savegame}
     */
    getSavegameById(internalId) {
        const metadata = this.getGameMetaDataByInternalId(internalId);
        if (!metadata) {
            return null;
        }
        return new Savegame(this.app, { internalId, metaDataRef: metadata });
    }

    /**
     * Deletes a savegame
     * @param {SavegameMetadata} game
     */
    deleteSavegame(game) {
        const handle = new Savegame(this.app, {
            internalId: game.internalId,
            metaDataRef: game,
        });

        return handle
            .deleteAsync()
            .catch(err => {
                console.warn("Failed to unlink physical savegame file, still removing:", err);
            })
            .then(() => {
                for (let i = 0; i < this.currentData.savegames.length; ++i) {
                    const potentialGame = this.currentData.savegames[i];
                    if (potentialGame.internalId === handle.internalId) {
                        this.currentData.savegames.splice(i, 1);
                        break;
                    }
                }

                return this.writeAsync();
            });
    }

    /**
     * Returns a given games metadata by id
     * @param {string} id
     * @returns {SavegameMetadata}
     */
    getGameMetaDataByInternalId(id) {
        for (let i = 0; i < this.currentData.savegames.length; ++i) {
            const data = this.currentData.savegames[i];
            if (data.internalId === id) {
                return data;
            }
        }
        logger.error("Savegame internal id not found:", id);
        return null;
    }

    /**
     * Creates a new savegame
     * @returns {Savegame}
     */
    createNewSavegame() {
        const id = this.generateInternalId();

        const metaData = /** @type {SavegameMetadata} */ ({
            lastUpdate: Date.now(),
            version: Savegame.getCurrentVersion(),
            internalId: id,
        });

        this.currentData.savegames.push(metaData);

        // Notice: This is async and happening in the background
        this.updateAfterSavegamesChanged();

        return new Savegame(this.app, {
            internalId: id,
            metaDataRef: metaData,
        });
    }

    /**
     * Attempts to import a savegame
     * @param {object} data
     */
    importSavegame(data) {
        const savegame = this.createNewSavegame();

        const migrationResult = savegame.migrate(data);
        if (migrationResult.isBad()) {
            return Promise.reject("Failed to migrate: " + migrationResult.reason);
        }

        savegame.currentData = data;
        const verification = savegame.verify(data);
        if (verification.isBad()) {
            return Promise.reject("Verification failed: " + verification.result);
        }

        return savegame.writeSavegameAndMetadata().then(() => this.updateAfterSavegamesChanged());
    }

    /**
     * Hook after the savegames got changed
     */
    updateAfterSavegamesChanged() {
        return this.sortSavegames().then(() => this.writeAsync());
    }

    /**
     * Sorts all savegames by their creation time descending
     * @returns {Promise<any>}
     */
    sortSavegames() {
        this.currentData.savegames.sort((a, b) => b.lastUpdate - a.lastUpdate);
        let promiseChain = Promise.resolve();
        while (this.currentData.savegames.length > 30) {
            const toRemove = this.currentData.savegames.pop();

            // Try to remove the savegame since its no longer available
            const game = new Savegame(this.app, {
                internalId: toRemove.internalId,
                metaDataRef: toRemove,
            });
            promiseChain = promiseChain
                .then(() => game.deleteAsync())
                .then(
                    () => {},
                    err => {
                        logger.error(this, "Failed to remove old savegame:", toRemove, ":", err);
                    }
                );
        }

        return promiseChain;
    }

    /**
     * Helper method to generate a new internal savegame id
     */
    generateInternalId() {
        if (self.crypto && self.crypto.randomUUID) {
            return self.crypto.randomUUID();
        }
        // Fallback for non-secure contexts / older browsers where randomUUID is unavailable
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
            (c ^ (self.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
        );
    }

    // End

    initialize() {
        // First read, then directly write to ensure we have the latest data
        // @ts-ignore
        return this.readAsync()
            .then(() => {
                if (G_IS_DEV && globalConfig.debug.disableSavegameWrite) {
                    return Promise.resolve();
                }
                return this.updateAfterSavegamesChanged();
            })
            .then(result => {
                // Fire-and-forget: local savegames are already usable at this point, cloud sync
                // (a network round trip, possibly slow/offline) must never block app startup on it.
                this.syncWithCloud();
                return result;
            });
    }

    // -- Cloud sync (see PlatformWrapperImplBrowser.getSupportsSavegameSync and its VK
    // implementation - satisfies VK rule 2.3.8, "progress must carry over across devices". Not
    // done here: no tombstones, so a savegame deleted on this device can still be pulled back
    // down from another device/the cloud that hasn't deleted its own copy yet - accepted
    // tradeoff for never silently destroying a player's progress; revisit if this bites someone.

    /**
     * Pulls the cloud's savegame bundle, merges in anything newer/missing (never deletes a local
     * savegame just because the cloud lacks it), then re-uploads so every device converges.
     */
    async syncWithCloud() {
        if (!this.app.platformWrapper.getSupportsSavegameSync()) {
            logger.log("Cloud savegame sync not supported on this platform, skipping");
            return;
        }
        logger.log("Starting cloud savegame sync");
        try {
            const cloudBundle = await this.app.platformWrapper.getSyncedSavegameBundle();
            if (cloudBundle) {
                await this.mergeCloudBundle(cloudBundle);
            }
            await this.pushSyncBundle();
            logger.log("Cloud savegame sync finished");
        } catch (ex) {
            logger.error("Savegame cloud sync failed:", ex);
        }
    }

    /**
     * @param {{savegames: Array<SavegameMetadata>, games: Record<string, object>}} cloudBundle
     */
    async mergeCloudBundle(cloudBundle) {
        let changed = false;
        for (const cloudMeta of cloudBundle.savegames ?? []) {
            const localMeta = this.currentData.savegames.find(g => g.internalId === cloudMeta.internalId);
            if (localMeta && localMeta.lastUpdate >= cloudMeta.lastUpdate) {
                continue; // local copy is already as new or newer
            }
            const cloudGame = cloudBundle.games?.[cloudMeta.internalId];
            // Skip anything from a build we can't safely read back (a device on a newer/older
            // version synced this save) rather than risk corrupting it with a blind write.
            if (!cloudGame || cloudGame.version !== Savegame.getCurrentVersion()) {
                continue;
            }
            const savegame = new Savegame(this.app, { internalId: cloudMeta.internalId, metaDataRef: cloudMeta });
            savegame.currentData = cloudGame;
            await savegame.writeAsync();
            if (localMeta) {
                Object.assign(localMeta, cloudMeta);
            } else {
                this.currentData.savegames.push({ ...cloudMeta });
            }
            changed = true;
        }
        if (changed) {
            await this.sortSavegames();
            await super.writeAsync(); // super: avoid re-triggering the push this merge is part of
        }
    }

    /**
     * Uploads every local savegame's full content to the cloud, unconditionally replacing
     * whatever was stored - safe because mergeCloudBundle above always runs first on a fresh
     * sync, so nothing newer gets clobbered; a save made concurrently on another device between
     * this device's own syncs can still be overwritten on push, same last-writer-wins tradeoff a
     * single savegame slot has always had.
     */
    async pushSyncBundle() {
        if (!this.app.platformWrapper.getSupportsSavegameSync()) {
            return;
        }
        logger.log("Pushing", this.currentData.savegames.length, "savegame(s) to cloud");
        const games = {};
        for (const meta of this.currentData.savegames) {
            const savegame = new Savegame(this.app, { internalId: meta.internalId, metaDataRef: meta });
            try {
                games[meta.internalId] = await savegame.readAsync();
            } catch (ex) {
                logger.warn("Skipping unreadable savegame during cloud push:", meta.internalId, ex);
            }
        }
        await this.app.platformWrapper.pushSavegameBundle({ savegames: this.currentData.savegames, games });
        logger.log("Pushed savegame bundle to cloud");
    }
}
