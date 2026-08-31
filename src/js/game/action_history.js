/* typehints:start */
import { Entity } from "./entity";
import { GameRoot } from "./root";
/* typehints:end */

// How many undo steps to remember - older entries just fall off the end.
const MAX_HISTORY_LENGTH = 30;

/**
 * @typedef {{ undo: function, redo: function, meta?: any }} HistoryCommand
 */

/**
 * Undo/redo history for building placement and deletion.
 *
 * Records itself transactionally rather than off a single "this one entity
 * changed" signal: GameLogic.tryPlaceBuilding and tryDeleteBuilding both
 * unconditionally report to noteEntityPlaced/noteEntityWillBeDeleted, but
 * those are no-ops unless a transaction is currently open (see
 * beginTransaction/endTransaction below) - so every other caller (puzzle
 * editor setup, savegame/puzzle deserialization, the mass-selector, and
 * every side effect *other* systems trigger - automatic tunnel-pair belt
 * cleanup, lever/constant-signal rebuilds, wired-pins auto-cleanup, ...) is
 * completely unaffected, by construction, with no per-caller allowlist to
 * maintain.
 *
 * A transaction wraps one user-initiated action end to end - a single tap, a
 * whole dragged belt path, one delete-mode tap - not one tile at a time (see
 * the beginTransaction/endTransaction call sites in mobile_controls.js). It
 * captures every placement/deletion that happens synchronously within it, in
 * order, including side effects other systems trigger off entityManuallyPlaced
 * (e.g. underground_belt.js silently deleting obsolete belts between a
 * newly-completed tunnel pair - placing the tunnel receiver and the belts it
 * silently removes both land in the same transaction, since that removal
 * happens synchronously inside the same tryPlaceCurrentBuildingAt call).
 * Undo replays the recorded operations in reverse, redo replays them
 * forwards, so every affected building comes back - not just the one
 * directly tapped.
 */
export class ActionHistory {
    /** @param {GameRoot} root */
    constructor(root) {
        this.root = root;

        /** @type {Array<HistoryCommand>} */
        this.undoStack = [];
        /** @type {Array<HistoryCommand>} */
        this.redoStack = [];

        /**
         * @type {{ operations: Array<{ type: "place"|"delete", snapshot: Entity }> }}
         */
        this.transaction = null;
    }

    get canUndo() {
        return this.undoStack.length > 0;
    }

    get canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Opens a new recording window - call once around a single user action
     * (a tap, a whole dragged path, a delete-mode tap), not per tile placed.
     */
    beginTransaction() {
        this.transaction = { operations: [] };
    }

    /**
     * Called by GameLogic.tryPlaceBuilding after every successful placement -
     * a no-op unless a transaction is currently open.
     * @param {Entity} entity
     */
    noteEntityPlaced(entity) {
        if (!this.transaction) {
            return;
        }
        this.transaction.operations.push({ type: "place", snapshot: entity.clone() });
    }

    /**
     * Called by GameLogic.tryDeleteBuilding right before every deletion - a
     * no-op unless a transaction is currently open.
     * @param {Entity} entity
     */
    noteEntityWillBeDeleted(entity) {
        if (!this.transaction) {
            return;
        }
        this.transaction.operations.push({ type: "delete", snapshot: entity.clone() });
    }

    /**
     * Closes the current transaction and pushes it as a single undo step, if
     * anything actually happened during it.
     *
     * @param {any=} meta Opaque, caller-defined data stashed on the resulting
     * command and handed back by undo()/redo() - lets a caller recover
     * transient UI state a command affects beyond the map itself. E.g.
     * mobile_controls.js's belt-continuation ("lay the next tap's path from
     * wherever the belt last ended") needs to roll its own lastBeltTile back
     * to wherever it was *before* this placement on undo, and forward to
     * this placement's own end tile on redo - ActionHistory doesn't know or
     * care what a "belt" is, it just carries whatever the caller attaches.
     */
    endTransaction(meta) {
        const tx = this.transaction;
        this.transaction = null;
        if (!tx || tx.operations.length === 0) {
            return;
        }
        const ops = tx.operations;
        this.push({
            undo: () => {
                for (let i = ops.length - 1; i >= 0; --i) {
                    const op = ops[i];
                    if (op.type === "place") {
                        this.removeAt(op.snapshot);
                    } else {
                        this.restore(op.snapshot);
                    }
                }
            },
            redo: () => {
                for (let i = 0; i < ops.length; ++i) {
                    const op = ops[i];
                    if (op.type === "place") {
                        this.restore(op.snapshot);
                    } else {
                        this.removeAt(op.snapshot);
                    }
                }
            },
            meta,
        });
    }

    /**
     * @param {HistoryCommand} command
     */
    push(command) {
        this.undoStack.push(command);
        if (this.undoStack.length > MAX_HISTORY_LENGTH) {
            this.undoStack.shift();
        }
        // A fresh action invalidates whatever redo history there was.
        this.redoStack = [];
    }

    /**
     * @returns {any} The undone command's meta (see endTransaction), or null
     * if there was nothing to undo.
     */
    undo() {
        if (!this.canUndo) {
            return null;
        }
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        return command.meta;
    }

    /**
     * @returns {any} The redone command's meta (see endTransaction), or null
     * if there was nothing to redo.
     */
    redo() {
        if (!this.canRedo) {
            return null;
        }
        const command = this.redoStack.pop();
        command.redo();
        this.undoStack.push(command);
        return command.meta;
    }

    /**
     * Deletes whatever entity currently occupies the snapshot's original
     * tile - looked up by position/layer rather than uid, since every
     * restore() gives the entity a fresh uid from the entity manager.
     * @param {Entity} snapshot
     */
    removeAt(snapshot) {
        const origin = snapshot.components.StaticMapEntity.origin;
        const entity = this.root.map.getLayerContentXY(origin.x, origin.y, snapshot.layer);
        if (entity) {
            this.root.logic.tryDeleteBuilding(entity);
        }
    }

    /**
     * Restores a cloned entity snapshot directly onto the map - mirrors
     * Blueprint.tryPlace rather than GameLogic.tryPlaceBuilding, since this
     * is recreating exactly what was there before rather than running a
     * fresh cost/collision check. Clones the snapshot again rather than
     * placing it directly so the same snapshot can be restored more than
     * once across repeated undo/redo cycles.
     *
     * No transaction is open at this point - undo()/redo() never call
     * beginTransaction - so any collision cleanup this triggers via
     * freeEntityAreaBeforeBuild (a rare edge case, restoring back onto a
     * tile that should normally already be empty) is correctly ignored
     * rather than re-recorded as new history.
     * @param {Entity} snapshot
     */
    restore(snapshot) {
        const clone = snapshot.clone();
        this.root.logic.freeEntityAreaBeforeBuild(clone);
        this.root.map.placeStaticEntity(clone);
        this.root.entityMgr.registerEntity(clone);
    }
}
