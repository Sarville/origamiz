import { globalConfig } from "../core/config";
import { ExplainedResult } from "../core/explained_result";
import { Logger } from "../core/logging";
import { ReadWriteProxy } from "../core/read_write_proxy";
import { MODS } from "../mods/modloader";
import { SavegameInterface } from "./savegame_interface";
import { SavegameSerializer } from "./savegame_serializer";

const logger = new Logger("savegame");

/**
 * @typedef {import("../application").Application} Application
 * @typedef {import("../game/root").GameRoot} GameRoot
 * @typedef {import("./savegame_typedefs").SavegameData} SavegameData
 * @typedef {import("./savegame_typedefs").SavegameMetadata} SavegameMetadata
 * @typedef {import("./savegame_typedefs").SerializedGame} SerializedGame
 */

export class Savegame extends ReadWriteProxy {
    /**
     *
     * @param {Application} app
     * @param {object} param0
     * @param {string} param0.internalId
     * @param {SavegameMetadata} param0.metaDataRef Handle to the meta data
     */
    constructor(app, { internalId, metaDataRef }) {
        super(app.storage, "savegame-" + internalId + ".bin");

        /** @type {Application} */
        this.app = app;

        this.internalId = internalId;
        this.metaDataRef = metaDataRef;

        /** @type {SavegameData} */
        this.currentData = this.getDefaultData();
    }

    //////// RW Proxy Impl //////////

    /**
     * @returns {number}
     */
    static getCurrentVersion() {
        // 1014: HubGoals.adRewardClaimedAt (rewarded-ad cooldown) - see
        // migrate() below for the 1013 -> 1014 step. (1013 itself briefly
        // shipped a different, per-day-counter shape for the same feature
        // during development; 1013 -> 1014 also repairs any save written
        // during that window.)
        return 1014;
    }

    /**
     * @returns {number}
     */
    getCurrentVersion() {
        return /** @type {typeof Savegame} */ (this.constructor).getCurrentVersion();
    }

    /**
     * Returns the savegames default data
     * @returns {SavegameData}
     */
    getDefaultData() {
        return {
            version: this.getCurrentVersion(),
            dump: null,
            lastUpdate: Date.now(),
            mods: MODS.getModsListForSavegame(),
        };
    }

    /**
     * Migrates the savegames data (called by ReadWriteProxy.readAsync when
     * data.version < getCurrentVersion(), modifies `data` in place - see
     * that method for the exact call site).
     * @param {SavegameData} data
     */
    migrate(data) {
        if (data.version === 1010) {
            // dailyBonusClaimedAt (Shop daily bonus) added in 1011 - a save
            // from before it existed just never claimed one yet. Saves with
            // no game started (dump === null) have no HubGoals to patch.
            if (data.dump && data.dump.hubGoals) {
                data.dump.hubGoals.dailyBonusClaimedAt = 0;
            }
            data.version = 1011;
        }

        if (data.version === 1011) {
            // exchangeLimitUpgrades/exchangeOperationsRemaining/exchangeLimitResetAt
            // (Shape Exchange daily limit) added in 1012 - a save from before
            // it existed never bought a limit upgrade and hasn't used the
            // daily limit yet, so it starts at the same defaults the
            // constructor gives a fresh HubGoals.
            if (data.dump && data.dump.hubGoals) {
                data.dump.hubGoals.exchangeLimitUpgrades = 0;
                data.dump.hubGoals.exchangeOperationsRemaining = 3;
                data.dump.hubGoals.exchangeLimitResetAt = 0;
            }
            data.version = 1012;
        }

        if (data.version === 1012) {
            // adRewardClaimedAt (rewarded-ad cooldown) added in 1013 - a
            // save from before it existed hasn't watched a rewarded ad yet,
            // so it starts at the same default the constructor gives a
            // fresh HubGoals.
            if (data.dump && data.dump.hubGoals) {
                data.dump.hubGoals.adRewardClaimedAt = 0;
            }
            data.version = 1013;
        }

        if (data.version === 1013) {
            // 1013 briefly shipped adRewardClaimedAt as a per-day counter
            // (adRewardsRemaining/adRewardsResetAt) before being redesigned
            // as a flat cooldown in 1014 - repair any save written during
            // that window (the stray old fields are just ignored, harmless
            // to leave behind). A save that came from the 1012 branch above
            // already has adRewardClaimedAt set, so this is a no-op for it.
            if (data.dump && data.dump.hubGoals && data.dump.hubGoals.adRewardClaimedAt === undefined) {
                data.dump.hubGoals.adRewardClaimedAt = 0;
            }
            data.version = 1014;
        }

        if (data.version !== this.getCurrentVersion()) {
            return ExplainedResult.bad("Savegame upgrade is not supported");
        }

        return ExplainedResult.good();
    }

    /**
     * Verifies the savegames data
     * @param {SavegameData} data
     */
    verify(data) {
        if (!data.dump) {
            // Well, guess that works
            return ExplainedResult.good();
        }

        if (!this.getDumpReaderForExternalData(data).validate()) {
            return ExplainedResult.bad("dump-reader-failed-validation");
        }
        return ExplainedResult.good();
    }

    //////// Subclasses interface  ////////

    /**
     * Returns if this game can be saved on disc
     * @returns {boolean}
     */
    isSaveable() {
        return true;
    }

    /**
     * Returns the *real* last update of the savegame, not the one of the metadata
     * which could also be the servers one
     */
    getRealLastUpdate() {
        return this.currentData.lastUpdate;
    }

    /**
     * Returns if this game has a serialized game dump
     */
    hasGameDump() {
        return !!this.currentData.dump && this.currentData.dump.entities.length > 0;
    }

    /**
     * Returns the current game dump
     * @returns {SerializedGame}
     */
    getCurrentDump() {
        return this.currentData.dump;
    }

    /**
     * Returns a reader to access the data
     * @returns {SavegameInterface}
     */
    getDumpReader() {
        if (!this.currentData.dump) {
            logger.warn("Getting reader on null-savegame dump");
        }

        return new SavegameInterface(this.currentData);
    }

    /**
     * Returns a reader to access external data
     * @returns {SavegameInterface}
     */
    getDumpReaderForExternalData(data) {
        assert(data.version, "External data contains no version");
        return new SavegameInterface(data);
    }

    ///////// Public Interface ///////////

    /**
     * Updates the last update field so we can send the savegame to the server,
     * WITHOUT Saving!
     */
    setLastUpdate(time) {
        this.currentData.lastUpdate = time;
    }

    /**
     *
     * @param {GameRoot} root
     */
    updateData(root) {
        // Construct a new serializer
        const serializer = new SavegameSerializer();

        // let timer = performance.now();
        const dump = serializer.generateDumpFromGameRoot(root);
        if (!dump) {
            return false;
        }

        const shadowData = {};
        shadowData.dump = dump;
        shadowData.lastUpdate = new Date().getTime();
        shadowData.version = this.getCurrentVersion();
        shadowData.mods = MODS.getModsListForSavegame();

        const reader = this.getDumpReaderForExternalData(shadowData);

        // Validate (not in prod though)
        if (!G_IS_RELEASE) {
            const validationResult = reader.validate();
            if (!validationResult) {
                return false;
            }
        }

        // Save data
        this.currentData = shadowData;
    }

    /**
     * Writes the savegame as well as its metadata
     */
    writeSavegameAndMetadata() {
        return this.writeAsync().then(() => this.saveMetadata());
    }

    /**
     * Updates the savegames metadata
     */
    saveMetadata() {
        this.metaDataRef.lastUpdate = new Date().getTime();
        this.metaDataRef.version = this.getCurrentVersion();
        if (!this.hasGameDump()) {
            this.metaDataRef.level = 0;
        } else {
            this.metaDataRef.level = this.currentData.dump.hubGoals.level;
        }

        return this.app.savegameMgr.writeAsync();
    }

    /**
     * @see ReadWriteProxy.writeAsync
     * @returns {Promise<any>}
     */
    writeAsync() {
        if (G_IS_DEV && globalConfig.debug.disableSavegameWrite) {
            return Promise.resolve();
        }
        return super.writeAsync();
    }
}
