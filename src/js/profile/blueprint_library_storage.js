/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { DefaultCompression } from "../core/compression";
import { ExplainedResult } from "../core/explained_result";
import { Logger } from "../core/logging";
import { ReadWriteProxy } from "../core/read_write_proxy";

const logger = new Logger("blueprint-library");

// Soft cap on the compressed+base64 blob pushed to Yandex's shared 200 KB
// player-data document (wallet + achievements live in the same document,
// see yandex_wrapper.js) - leaves headroom for those plus future keys.
const CLOUD_BUDGET_BYTES = 150 * 1024;

function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Persists the player's saved blueprints. Account-wide like achievements
 * (not tied to a savegame) - the local copy is the source of truth and
 * survives reload the same way a savegame does; the cloud copy is a
 * best-effort backup/restore for a new device or cleared local storage,
 * not a live multi-device merge. Unlike WalletStorage, blueprints aren't a
 * contested resource that needs a session lock - last local write simply
 * wins, the same way overwriting a save file from another device would.
 */
export class BlueprintLibraryStorage extends ReadWriteProxy {
    /**
     * @param {Application} app
     * @param {import("../platform/storage").Storage} storage
     */
    constructor(app, storage) {
        super(storage, "blueprints.bin");
        this.app = app;

        /**
         * Whether the last cloud push actually happened - false means the
         * library has grown past CLOUD_BUDGET_BYTES, so the cloud backup is
         * stale. The local copy is unaffected either way (see class doc).
         */
        this.cloudBackupCurrent = true;
    }

    async initialize() {
        await this.readAsync();
        await this.hydrateFromCloudIfEmpty();
    }

    /**
     * Only pulls from the cloud when there's nothing local to lose - a
     * fresh install/device or cleared storage. If local already has
     * entries it's the source of truth and gets pushed instead, as a
     * safety net in case an earlier push (e.g. right before a crash) never
     * made it out.
     */
    async hydrateFromCloudIfEmpty() {
        if (this.currentData.blueprints.length > 0) {
            await this.pushToCloud();
            return;
        }
        try {
            const cloud = await this.app.platformWrapper.getCloudData();
            const blob = cloud?.blueprintLibrary;
            if (typeof blob !== "string" || !blob) {
                return;
            }
            const decompressed = await new DefaultCompression().decompress(base64ToBytes(blob));
            if (Array.isArray(decompressed) && decompressed.length > 0) {
                this.currentData.blueprints = decompressed;
                await this.writeAsync();
            }
        } catch (ex) {
            logger.error("Failed to hydrate blueprint library from cloud:", ex);
        }
    }

    getAll() {
        return this.currentData.blueprints;
    }

    getTags() {
        const tags = new Set();
        for (const bp of this.currentData.blueprints) {
            for (const tag of bp.tags) {
                tags.add(tag);
            }
        }
        return Array.from(tags).sort();
    }

    /**
     * @param {string} name
     * @param {Array<object>} entities Serialized entities, see Blueprint.serializeEntities
     * @param {string[]} tags
     */
    add(name, entities, tags = []) {
        const entry = {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            name: (name || "").trim() || "Blueprint",
            tags: tags.map(t => t.trim()).filter(Boolean),
            entities,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.currentData.blueprints.push(entry);
        this.writeAsync();
        this.pushToCloud();
        return entry;
    }

    /**
     * @param {string} id
     * @param {{name?: string, tags?: string[]}} updates
     */
    update(id, updates) {
        const entry = this.currentData.blueprints.find(bp => bp.id === id);
        if (!entry) {
            return false;
        }
        if (updates.name !== undefined) {
            entry.name = updates.name.trim() || "Blueprint";
        }
        if (updates.tags !== undefined) {
            entry.tags = updates.tags.map(t => t.trim()).filter(Boolean);
        }
        entry.updatedAt = Date.now();
        this.writeAsync();
        this.pushToCloud();
        return true;
    }

    /** @param {string} id */
    remove(id) {
        const idx = this.currentData.blueprints.findIndex(bp => bp.id === id);
        if (idx === -1) {
            return false;
        }
        this.currentData.blueprints.splice(idx, 1);
        this.writeAsync();
        this.pushToCloud();
        return true;
    }

    /**
     * Best-effort cloud backup of the whole library as a single compressed
     * blob - one gzip frame shares its dictionary across every blueprint,
     * which compresses better and costs less framing overhead than
     * compressing each blueprint separately. Silently skipped
     * (cloudBackupCurrent flips false) once it no longer fits
     * CLOUD_BUDGET_BYTES; the local copy remains authoritative either way,
     * this only means a new device won't get everything back.
     */
    async pushToCloud() {
        try {
            const compressed = await new DefaultCompression().compress(this.currentData.blueprints);
            const blob = bytesToBase64(compressed);
            if (blob.length > CLOUD_BUDGET_BYTES) {
                this.cloudBackupCurrent = false;
                logger.warn(
                    `Blueprint library (${blob.length} bytes) exceeds the cloud backup budget of ${CLOUD_BUDGET_BYTES} bytes - skipping cloud push, local copy stays authoritative.`
                );
                return;
            }
            this.cloudBackupCurrent = true;
            await this.app.platformWrapper.setCloudData({ blueprintLibrary: blob });
        } catch (ex) {
            logger.error("Failed to push blueprint library to cloud:", ex);
        }
    }

    // RW Proxy impl

    verify(data) {
        if (!Array.isArray(data.blueprints)) {
            return ExplainedResult.bad("missing key 'blueprints'");
        }
        return ExplainedResult.good();
    }

    getDefaultData() {
        return {
            version: this.getCurrentVersion(),
            blueprints: [],
        };
    }

    getCurrentVersion() {
        return 1;
    }

    migrate(data) {
        return ExplainedResult.good();
    }
}
