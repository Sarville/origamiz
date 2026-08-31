/* typehints:start */
import { Entity } from "./entity";
import { GameRoot } from "./root";
/* typehints:end */

// How many undo steps to remember - older entries just fall off the end.
const MAX_HISTORY_LENGTH = 30;

/**
 * @typedef {{ undo: function, redo: function }} HistoryCommand
 */

/**
 * Undo/redo history for building placement and (mobile) deletion. Records
 * itself off the existing entityManuallyPlaced/bulkOperationFinished signals
 * rather than being called explicitly from every placement call site - both
 * the desktop and mobile placers already route every interactive placement
 * through HUDBuildingPlacerLogic.tryPlaceCurrentBuildingAt, which dispatches
 * entityManuallyPlaced exactly once per placed tile, so hooking that one
 * signal covers both platforms for free.
 *
 * Deletion has no equivalent shared signal - GameLogic.tryDeleteBuilding is
 * also called internally for all sorts of non-user-facing cleanup (automatic
 * tunnel pairing, lever/constant-signal rebuilds, mass-selector, ...), so
 * hooking it globally would record a lot of noise that was never a real user
 * action. makeDeleteEntry() is instead called explicitly by the one place
 * that currently needs it (the mobile delete-mode tap in mobile_controls.js).
 *
 * ponytail: placing a building on top of a replaceable one (e.g. re-placing
 * a belt to change its direction) only records the new placement, not the
 * old entity it silently replaced - undoing it removes the new building but
 * doesn't bring the old one back. Add if replace-in-place undo turns out to
 * matter in practice.
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
         * Sub-commands recorded while a bulk operation (drag-placed belt
         * path, blueprint paste) is in progress - flushed as a single
         * combined command once it finishes, so e.g. a long belt drag undoes
         * in one step instead of one per tile.
         * @type {Array<HistoryCommand>}
         */
        this.pendingGroup = null;

        root.signals.entityManuallyPlaced.add(this.recordPlace, this);
        root.signals.bulkOperationFinished.add(this.flushPendingGroup, this);
    }

    get canUndo() {
        return this.undoStack.length > 0;
    }

    get canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * @param {Entity} entity The entity that was just placed
     */
    recordPlace(entity) {
        const snapshot = entity.clone();
        this.pushCommand({
            undo: () => this.removeAt(snapshot),
            redo: () => this.restore(snapshot),
        });
    }

    /**
     * Builds (but doesn't push) an undo entry for deleting the given entity -
     * call this BEFORE actually deleting it, then pushCommand() the result
     * only if the deletion actually succeeds (GameLogic.tryDeleteBuilding
     * can refuse, e.g. for the hub - nothing should be recorded then).
     * @param {Entity} entity The entity about to be deleted
     * @returns {HistoryCommand}
     */
    makeDeleteEntry(entity) {
        const snapshot = entity.clone();
        return {
            undo: () => this.restore(snapshot),
            redo: () => this.removeAt(snapshot),
        };
    }

    /**
     * @param {HistoryCommand} command
     */
    pushCommand(command) {
        if (this.root.bulkOperationRunning) {
            if (!this.pendingGroup) {
                this.pendingGroup = [];
            }
            this.pendingGroup.push(command);
            return;
        }
        this.push(command);
    }

    flushPendingGroup() {
        const commands = this.pendingGroup;
        this.pendingGroup = null;
        if (!commands || commands.length === 0) {
            return;
        }
        this.push({
            undo: () => {
                for (let i = commands.length - 1; i >= 0; --i) {
                    commands[i].undo();
                }
            },
            redo: () => {
                for (let i = 0; i < commands.length; ++i) {
                    commands[i].redo();
                }
            },
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

    undo() {
        if (!this.canUndo) {
            return;
        }
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
    }

    redo() {
        if (!this.canRedo) {
            return;
        }
        const command = this.redoStack.pop();
        command.redo();
        this.undoStack.push(command);
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
     * @param {Entity} snapshot
     */
    restore(snapshot) {
        const clone = snapshot.clone();
        this.root.logic.freeEntityAreaBeforeBuild(clone);
        this.root.map.placeStaticEntity(clone);
        this.root.entityMgr.registerEntity(clone);
    }
}
