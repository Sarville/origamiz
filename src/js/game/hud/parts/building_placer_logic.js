import { drawRotatedSprite } from "../../../core/draw_utils";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { Loader } from "../../../core/loader";
import { Signal, STOP_PROPAGATION } from "../../../core/signal";
import { TrackedState } from "../../../core/tracked_state";
import { safeModulo } from "../../../core/utils";
import {
    Vector,
    enumDirection,
    enumDirectionToAngle,
    enumDirectionToVector,
    enumInvertedDirections,
} from "../../../core/vector";
import { SOUNDS } from "../../../platform/sound";
import { getBuildingDataFromCode, getCodeFromBuildingData } from "../../building_codes";
import { MetaHubBuilding } from "../../buildings/hub";
import { enumMinerVariants, MetaMinerBuilding } from "../../buildings/miner";
import { enumMouseButton } from "../../camera";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { Entity } from "../../entity";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { defaultBuildingVariant, MetaBuilding } from "../../meta_building";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { BaseHUDPart } from "../base_hud_part";
import { BeltPathPlanner } from "./belt_path_planner";
import { OverviewBuildingPolicy } from "./overview_building";

/**
 * Contains all logic for the building placer - this doesn't include the rendering
 * of info boxes or drawing.
 */
export class HUDBuildingPlacerLogic extends BaseHUDPart {
    /**
     * Initializes the logic
     * @see BaseHUDPart.initialize
     */
    initialize() {
        /**
         * We use a fake entity to get information about how a building will look
         * once placed
         * @type {Entity}
         */
        this.fakeEntity = null;

        // Signals
        this.signals = {
            variantChanged: new Signal(),
            draggingStarted: new Signal(),
        };

        /**
         * The current building
         * @type {TypedTrackedState<MetaBuilding?>}
         */
        this.currentMetaBuilding = new TrackedState(this.onSelectedMetaBuildingChanged, this);

        /**
         * The current rotation
         * @type {number}
         */
        this.currentBaseRotationGeneral = 0;

        /**
         * The current rotation preference for each building.
         * @type{Object.<string,number>}
         */
        this.preferredBaseRotations = {};

        /**
         * Whether we are currently dragging
         * @type {boolean}
         */
        this.currentlyDragging = false;

        /**
         * Current building variant
         * @type {TypedTrackedState<string>}
         */
        this.currentVariant = new TrackedState(() => this.signals.variantChanged.dispatch());

        /**
         * Whether we are currently drag-deleting
         * @type {boolean}
         */
        this.currentlyDeleting = false;

        /**
         * Stores which variants for each building we prefer, this is based on what
         * the user last selected
         * @type {Object.<string, string>}
         */
        this.preferredVariants = {};

        /**
         * The tile we last dragged from
         * @type {Vector}
         */
        this.lastDragTile = null;

        /**
         * Item 9: auto-tunnel/routing engine, shared with HUDMobileControls
         * (see belt_path_planner.js) - see beltDragStartTile's doc for how
         * desktop's own drag flow uses it.
         * @type {BeltPathPlanner}
         */
        this.beltPathPlanner = new BeltPathPlanner(this.root);

        // See update()'s own use - gates whether placement (and, on
        // overview zoom, belt tap-continuation via placeBeltTapAt below)
        // keeps working while the map is zoomed out into map overview.
        this.overviewBuildingPolicy = new OverviewBuildingPolicy(this.root);

        /**
         * Overview-zoom belt click-continuation (mirrors mobile's own
         * lastBeltTile/item 8): the tile the last belt segment ended at,
         * kept across separate clicks - unlike beltDragStartTile, never
         * cleared by abortDragging, only when the selection changes away
         * from belt (see onSelectedMetaBuildingChanged). Only actually
         * consulted from onMouseDown while zoomed into map overview - a
         * precise drag isn't practical at that scale, so overview clicks
         * are tap-continuation only, same as mobile. At normal zoom desktop
         * keeps its existing real-time drag placement, untouched.
         * @type {Vector}
         */
        this.lastBeltTile = null;

        /** @type {number} */
        this.lastBeltIncomingDirection = undefined;

        /**
         * Item 9 (desktop): the tile a belt drag started from - the anchor
         * tile itself is placed immediately on mouse-down same as any other
         * building (unchanged), but every tile from here on is only a
         * *preview* (beltDragPreviewEntries) until mouse-up, unlike every
         * other building's real-time per-tile Bresenham placement (onMouseMove
         * below) - a single "resolve the whole path, commit on release" point
         * is what lets findBeltPath plan a bounded-bend route and bridge
         * obstacles with a tunnel, which a real-time immediate-placement loop
         * has no way to do (it only ever sees one tile at a time, with no
         * "final destination" to route toward until the button is released).
         * Null whenever no belt drag is in progress.
         * @type {Vector}
         */
        this.beltDragStartTile = null;

        /** @type {Array<Vector>} */
        this.beltDragPath = [];

        /** @type {Array<import("./belt_path_planner").PathEntry>} */
        this.beltDragPreviewEntries = [];

        /**
         * Set alongside beltDragPreviewEntries whenever findBeltPath can't
         * make the currently-dragged path contiguous - beltDragPreviewEntries
         * is left empty and draw() shows a red tint over beltDragPath instead
         * of a ghost preview.
         * @type {boolean}
         */
        this.beltDragPreviewInvalid = false;

        /**
         * Item 9: a brief red flash over a just-released belt drag that
         * findBeltPath couldn't make contiguous - shown instead of placing
         * anything. Cleared automatically in update().
         * @type {{ path: Array<Vector>, startedAt: number }}
         */
        this.invalidBeltFlash = null;

        /**
         * The side for direction lock
         * @type {number} (0|1)
         */
        this.currentDirectionLockSide = 0;

        /**
         * Whether the side for direction lock has not yet been determined.
         * @type {boolean}
         */
        this.currentDirectionLockSideIndeterminate = true;

        /**
         * Item 4 (desktop transform/move, "T"): true while currentMetaBuilding
         * stands in for a real building picked up via startTransform (which
         * already deleted it), so cancelling the placement should restore the
         * original with a plain undo() instead of just losing it, and
         * confirming it should collapse the pickup's delete and the new
         * placement into a single undo step - mirrors mobile's own
         * movedBuildingCut (HUDMobileControls.beginMoveExistingBuilding).
         * @type {boolean}
         */
        this.movedBuildingCut = false;

        this.initializeBindings();
    }

    /**
     * Initializes all bindings
     */
    initializeBindings() {
        // KEYBINDINGS
        const keyActionMapper = this.root.keyMapper;
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateWhilePlacing).add(this.tryRotate, this);

        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateToUp).add(this.trySetRotate, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateToDown).add(this.trySetRotate, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateToRight).add(this.trySetRotate, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.rotateToLeft).add(this.trySetRotate, this);

        keyActionMapper.getBinding(KEYMAPPINGS.placement.cycleBuildingVariants).add(this.cycleVariants, this);
        keyActionMapper
            .getBinding(KEYMAPPINGS.placement.switchDirectionLockSide)
            .add(this.switchDirectionLockSide, this);
        keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.abortPlacement, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.pipette).add(this.startPipette, this);
        keyActionMapper.getBinding(KEYMAPPINGS.placement.moveBuilding).add(this.startTransform, this);
        keyActionMapper.getBinding(KEYMAPPINGS.ingame.undo).add(this.onUndo, this);
        keyActionMapper.getBinding(KEYMAPPINGS.ingame.redo).add(this.onRedo, this);
        this.root.gameState.inputReceiver.keyup.add(this.checkForDirectionLockSwitch, this);

        // BINDINGS TO GAME EVENTS
        this.root.hud.signals.buildingsSelectedForBlueprint.add(this.abortPlacement, this);
        this.root.hud.signals.pasteBlueprintRequested.add(this.abortPlacement, this);
        this.root.signals.storyGoalCompleted.add(() => this.signals.variantChanged.dispatch());
        this.root.signals.upgradePurchased.add(() => this.signals.variantChanged.dispatch());
        this.root.signals.editModeChanged.add(this.onEditModeChanged, this);

        // MOUSE BINDINGS
        this.root.camera.downPreHandler.add(this.onMouseDown, this);
        this.root.camera.movePreHandler.add(this.onMouseMove, this);
        this.root.camera.upPostHandler.add(this.onMouseUp, this);
        this.root.camera.wheelPreHandler.add(this.onMouseWheel, this);
    }

    /**
     * Called when the edit mode got changed
     * @param {Layer} layer
     */
    onEditModeChanged(layer) {
        const metaBuilding = this.currentMetaBuilding.get();
        if (metaBuilding) {
            if (metaBuilding.getLayer() !== layer) {
                // This layer doesn't fit the edit mode anymore
                this.currentMetaBuilding.set(null);
            }
        }
    }

    /**
     * Returns the current base rotation for the current meta-building.
     * @returns {number}
     */
    get currentBaseRotation() {
        if (!this.root.app.settings.getAllSettings().rotationByBuilding) {
            return this.currentBaseRotationGeneral;
        }
        const metaBuilding = this.currentMetaBuilding.get();
        if (metaBuilding && Object.hasOwn(this.preferredBaseRotations, metaBuilding.getId())) {
            return this.preferredBaseRotations[metaBuilding.getId()];
        } else {
            return this.currentBaseRotationGeneral;
        }
    }

    /**
     * Sets the base rotation for the current meta-building.
     * @param {number} rotation The new rotation/angle.
     */
    set currentBaseRotation(rotation) {
        if (!this.root.app.settings.getAllSettings().rotationByBuilding) {
            this.currentBaseRotationGeneral = rotation;
        } else {
            const metaBuilding = this.currentMetaBuilding.get();
            if (metaBuilding) {
                this.preferredBaseRotations[metaBuilding.getId()] = rotation;
            } else {
                this.currentBaseRotationGeneral = rotation;
            }
        }
    }

    /**
     * Returns if the direction lock is currently active
     * @returns {boolean}
     */
    get isDirectionLockActive() {
        const metaBuilding = this.currentMetaBuilding.get();
        return (
            metaBuilding &&
            metaBuilding.getHasDirectionLockAvailable(this.currentVariant.get()) &&
            this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.lockBeltDirection).pressed
        );
    }

    /**
     * Returns the current direction lock corner, that is, the corner between
     * mouse and original start point
     * @returns {Vector|null}
     */
    get currentDirectionLockCorner() {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return null;
        }

        if (!this.lastDragTile) {
            // Haven't dragged yet
            return null;
        }

        // Figure which points the line visits
        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const mouseTile = worldPos.toTileSpace();

        // Figure initial direction
        const dx = Math.abs(this.lastDragTile.x - mouseTile.x);
        const dy = Math.abs(this.lastDragTile.y - mouseTile.y);
        if (dx === 0 && dy === 0) {
            // Back at the start. Try a new direction.
            this.currentDirectionLockSideIndeterminate = true;
        } else if (this.currentDirectionLockSideIndeterminate) {
            this.currentDirectionLockSideIndeterminate = false;
            this.currentDirectionLockSide = dx <= dy ? 0 : 1;
        }

        if (this.currentDirectionLockSide === 0) {
            return new Vector(this.lastDragTile.x, mouseTile.y);
        } else {
            return new Vector(mouseTile.x, this.lastDragTile.y);
        }
    }

    /**
     * Aborts the placement
     */
    abortPlacement() {
        if (this.currentMetaBuilding.get()) {
            if (this.movedBuildingCut && this.root.actionHistory.canUndo) {
                // Restore the building startTransform picked up, same as
                // mobile's onCancelClicked.
                this.root.actionHistory.undo();
            }
            this.movedBuildingCut = false;
            this.currentMetaBuilding.set(null);
            return STOP_PROPAGATION;
        }
    }

    /**
     * Aborts any dragging
     */
    abortDragging() {
        this.currentlyDragging = false;
        this.currentlyDeleting = false;
        this.initialPlacementVector = null;
        this.lastDragTile = null;
        this.beltDragStartTile = null;
        this.beltDragPath = [];
        this.beltDragPreviewEntries = [];
        this.beltDragPreviewInvalid = false;
    }

    /**
     * Whether the currently selected building is a belt - item 9's
     * auto-tunnel drag only applies to belts, every other building keeps
     * the ordinary real-time Bresenham placement below.
     * @returns {boolean}
     */
    get isBeltSelected() {
        const metaBuilding = this.currentMetaBuilding.get();
        return !!metaBuilding && metaBuilding.getId() === "belt";
    }

    /**
     * Item 9: momentarily tints the given (unplaceable) belt drag red
     * instead of placing anything. Cleared automatically in update().
     * @param {Array<Vector>} path
     */
    flashInvalidBelt(path) {
        this.invalidBeltFlash = {
            path,
            startedAt: this.root.time.realtimeNow(),
        };
    }

    /**
     * Overview-zoom belt click-continuation (mirrors mobile's own
     * placeBeltTapAt/item 8): the first click just places one tile, same as
     * any other building - every following click continues the belt from
     * wherever it last ended to the newly clicked tile instead of placing a
     * fresh disconnected one, laid out the same L-shaped-corner way a
     * normal-zoom drag would. Only called from onMouseDown while zoomed
     * into map overview - dragging precisely across a zoomed-out view isn't
     * practical, so this is tap-only, same reasoning as mobile's item 8.
     * @param {Vector} tile
     */
    placeBeltTapAt(tile) {
        const metaBuilding = this.currentMetaBuilding.get();
        if (this.lastBeltTile) {
            const { path, resolved } = this.beltPathPlanner.findBeltPathToward(
                this.lastBeltTile,
                tile,
                false,
                this.lastBeltTile,
                this.lastBeltIncomingDirection
            );
            if (!resolved) {
                // Crosses an obstacle no unlocked tunnel can bridge - flash it
                // red instead of placing a gapped/broken belt.
                this.flashInvalidBelt(path);
                return;
            }
            const releaseWasOccupied = !!this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
            const result = this.beltPathPlanner.placePath(resolved, {
                tile: this.lastBeltTile,
                incoming: this.lastBeltIncomingDirection,
            });
            this.applyBeltContinuation(result, releaseWasOccupied);
        } else if (this.tryPlaceCurrentBuildingAt(tile)) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
            this.lastBeltTile = tile;
            this.lastBeltIncomingDirection = this.root.map.getLayerContentXY(
                tile.x,
                tile.y,
                "regular"
            )?.components.StaticMapEntity.rotation;
        }
    }

    /**
     * After a belt drag/tap commits, either extends lastBeltTile from the
     * new endpoint (landed on empty ground, same as before) or clears it
     * (landed on a tile that already had something there - a machine's
     * input, another belt trunk merged into, etc.) - same effect as
     * mobile's "new belt" button (onNewBeltClicked): the run is done, so
     * the next click starts a fresh, unconnected segment instead of
     * extending from here.
     * @param {{ placed: boolean, lastTile: Vector, lastIncoming: number= }} result
     * @param {boolean} releaseWasOccupied Whether the release tile already had map content *before* this placement.
     */
    applyBeltContinuation(result, releaseWasOccupied) {
        if (!result.placed) {
            return;
        }
        if (releaseWasOccupied) {
            this.lastBeltTile = null;
            this.lastBeltIncomingDirection = undefined;
        } else {
            this.lastBeltTile = result.lastTile;
            this.lastBeltIncomingDirection = result.lastIncoming;
        }
    }

    /**
     * @see BaseHUDPart.update
     */
    update() {
        // Abort placement if a dialog was shown in the meantime
        if (this.root.hud.hasBlockingOverlayOpen()) {
            this.abortPlacement();
            return;
        }

        if (this.invalidBeltFlash && this.root.time.realtimeNow() - this.invalidBeltFlash.startedAt > 0.6) {
            this.invalidBeltFlash = null;
        }

        // Always update since the camera might have moved
        const mousePos = this.root.app.mousePosition;
        if (mousePos) {
            this.onMouseMove(mousePos);
        }

        // Keep the current selection through overview zoom (both platforms -
        // see OverviewBuildingPolicy's doc) instead of clearing it, so
        // placement mode survives zooming out the same way it does on
        // mobile.
        if (this.root.camera.getIsMapOverlayActive() && !this.overviewBuildingPolicy.isAllowed()) {
            if (this.currentMetaBuilding.get()) {
                this.currentMetaBuilding.set(null);
            }
        }
    }

    /**
     * Tries to rotate the current building
     */
    tryRotate() {
        const selectedBuilding = this.currentMetaBuilding.get();
        if (selectedBuilding) {
            if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateInverseModifier).pressed) {
                this.currentBaseRotation = (this.currentBaseRotation + 270) % 360;
            } else {
                this.currentBaseRotation = (this.currentBaseRotation + 90) % 360;
            }
            const staticComp = this.fakeEntity.components.StaticMapEntity;
            staticComp.rotation = this.currentBaseRotation;
        }
    }

    /**
     * Rotates the current building while scrolling with shift held
     * @param {WheelEvent} event
     */
    onMouseWheel(event) {
        const selectedBuilding = this.currentMetaBuilding.get();
        if (!selectedBuilding) {
            return;
        }
        if (!this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateInverseModifier).pressed) {
            return;
        }
        if (event.deltaY === 0) {
            return;
        }

        this.currentBaseRotation = (this.currentBaseRotation + (event.deltaY < 0 ? 270 : 90)) % 360;
        const staticComp = this.fakeEntity.components.StaticMapEntity;
        staticComp.rotation = this.currentBaseRotation;
        return STOP_PROPAGATION;
    }

    /**
     * Rotates the current building to the specified direction.
     */
    trySetRotate() {
        const selectedBuilding = this.currentMetaBuilding.get();
        if (selectedBuilding) {
            if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateToUp).pressed) {
                this.currentBaseRotation = 0;
            } else if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateToDown).pressed) {
                this.currentBaseRotation = 180;
            } else if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateToRight).pressed) {
                this.currentBaseRotation = 90;
            } else if (this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateToLeft).pressed) {
                this.currentBaseRotation = 270;
            }

            const staticComp = this.fakeEntity.components.StaticMapEntity;
            staticComp.rotation = this.currentBaseRotation;
        }
    }

    /**
     * Tries to delete the building under the mouse
     */
    deleteBelowCursor() {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return false;
        }

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const tile = worldPos.toTileSpace();
        const contents = this.root.map.getTileContent(tile, this.root.currentLayer);
        if (contents) {
            this.root.actionHistory.beginTransaction();
            const deleted = this.root.logic.tryDeleteBuilding(contents);
            this.root.actionHistory.endTransaction();
            if (deleted) {
                this.root.soundProxy.playUi(SOUNDS.destroyBuilding);
                return true;
            }
        }
        return false;
    }

    /**
     * Starts the pipette function
     */
    startPipette() {
        // Disable in overview
        if (this.root.camera.getIsMapOverlayActive()) {
            return;
        }

        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const tile = worldPos.toTileSpace();
        this.pipetteAt(tile);
    }

    /**
     * Extracts the building type at the given tile into currentMetaBuilding
     * for further placement, without touching the original - shared by
     * startPipette (desktop's mouse-position-driven Q key) and mobile's own
     * tap-driven pipette mode (HUDMobileControls.onMouseDown).
     * @param {Vector} tile
     */
    pipetteAt(tile) {
        const contents = this.root.map.getTileContent(tile, this.root.currentLayer);
        if (!contents) {
            const tileBelow = this.root.map.getLowerLayerContentXY(tile.x, tile.y);

            // Check if there's a shape or color item below, if so select the miner
            if (
                tileBelow &&
                this.root.app.settings.getAllSettings().pickMinerOnPatch &&
                this.root.currentLayer === "regular" &&
                this.root.gameMode.hasResources()
            ) {
                this.currentMetaBuilding.set(gMetaBuildingRegistry.findByClass(MetaMinerBuilding));

                // Select chained miner if available, since that's always desired once unlocked
                if (this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_miner_chainable)) {
                    this.currentVariant.set(enumMinerVariants.chainable);
                }
            } else {
                this.currentMetaBuilding.set(null);
            }
            return;
        }

        // Try to extract the building
        const buildingCode = contents.components.StaticMapEntity.code;
        const extracted = getBuildingDataFromCode(buildingCode);

        // Disable pipetting the hub
        if (extracted.metaInstance.getId() === gMetaBuildingRegistry.findByClass(MetaHubBuilding).getId()) {
            this.currentMetaBuilding.set(null);
            return;
        }

        // Disallow picking excluded buildings
        if (this.root.gameMode.isBuildingExcluded(extracted.metaClass)) {
            this.currentMetaBuilding.set(null);
            return;
        }

        // If the building we are picking is the same as the one we have, clear the cursor.
        if (
            this.currentMetaBuilding.get() &&
            extracted.metaInstance.getId() === this.currentMetaBuilding.get().getId() &&
            extracted.variant === this.currentVariant.get()
        ) {
            this.currentMetaBuilding.set(null);
            return;
        }

        this.currentMetaBuilding.set(extracted.metaInstance);
        this.currentVariant.set(extracted.variant);
        this.currentBaseRotation = contents.components.StaticMapEntity.rotation;
    }

    /**
     * Item 4: picks up the building under the cursor into the normal
     * placement flow (mirrors mobile's HUDMobileControls.
     * beginMoveExistingBuilding) - unlike pipetteAt, this deletes the
     * original, so it can be rotated (the existing rotateWhilePlacing
     * binding) and moved (the mouse) like a fresh building, confirmed with a
     * left click (tryPlaceCurrentBuildingAt, unchanged) or cancelled with a
     * right click/Escape (abortPlacement, which restores the original via
     * movedBuildingCut). A no-op while something is already selected for
     * placement, so cycleBuildingVariants (also bound to "T") keeps working
     * as before whenever a building is actively being placed.
     */
    startTransform() {
        if (this.currentMetaBuilding.get()) {
            return;
        }

        if (this.root.camera.getIsMapOverlayActive()) {
            return;
        }

        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const tile = worldPos.toTileSpace();
        const contents = this.root.map.getTileContent(tile, this.root.currentLayer);
        if (!contents || !this.root.logic.canDeleteBuilding(contents)) {
            // Nothing there, or e.g. the hub - nothing to pick up.
            return;
        }

        const staticComp = contents.components.StaticMapEntity;
        const extracted = getBuildingDataFromCode(staticComp.code);
        const originRotation = staticComp.rotation;

        this.root.actionHistory.beginTransaction();
        const deleted = this.root.logic.tryDeleteBuilding(contents);
        this.root.actionHistory.endTransaction();
        if (!deleted) {
            return;
        }

        this.movedBuildingCut = true;
        this.currentMetaBuilding.set(extracted.metaInstance);
        this.currentVariant.set(extracted.variant);
        this.currentBaseRotation = originRotation;
    }

    /**
     * Global undo/redo (Ctrl+Z/Ctrl+X) - mirrors HUDMobileControls.
     * onUndoClicked/onRedoClicked, including keeping the overview-zoom belt
     * continuation state (lastBeltTile/lastBeltIncomingDirection, item 9) in
     * sync via the transaction's own meta.
     */
    onUndo() {
        if (this.root.actionHistory.canUndo) {
            const meta = this.root.actionHistory.undo();
            this.lastBeltTile = meta ? meta.beltTileBefore : null;
            this.lastBeltIncomingDirection = meta ? meta.beltIncomingBefore : undefined;
        }
    }

    /**
     * @see onUndo
     */
    onRedo() {
        if (this.root.actionHistory.canRedo) {
            const meta = this.root.actionHistory.redo();
            this.lastBeltTile = meta ? meta.beltTileAfter : null;
            this.lastBeltIncomingDirection = meta ? meta.beltIncomingAfter : undefined;
        }
    }

    /**
     * Switches the side for the direction lock manually
     */
    switchDirectionLockSide() {
        this.currentDirectionLockSide = 1 - this.currentDirectionLockSide;
    }

    /**
     * Checks if the direction lock key got released and if such, resets the placement
     * @param {any} args
     */
    checkForDirectionLockSwitch({ keyCode }) {
        if (
            keyCode ===
            this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.lockBeltDirection).keyCode
        ) {
            this.abortDragging();
        }
    }

    /**
     * Tries to place the current building at the given tile
     * @param {Vector} tile
     */
    tryPlaceCurrentBuildingAt(tile) {
        // Dont allow placing in overview mode unless the policy allows it
        // (see OverviewBuildingPolicy's doc) - both platforms: desktop's own
        // onMouseDown routes a click here directly at overview zoom now too
        // (see placeBeltTapAt/its call site below).
        if (this.root.camera.getIsMapOverlayActive() && !this.overviewBuildingPolicy.isAllowed()) {
            return;
        }

        const metaBuilding = this.currentMetaBuilding.get();
        const { rotation, rotationVariant } = metaBuilding.computeOptimalDirectionAndRotationVariantAtTile({
            root: this.root,
            tile,
            rotation: this.currentBaseRotation,
            variant: this.currentVariant.get(),
            layer: metaBuilding.getLayer(),
        });

        // One transaction per placement attempt, including any side effects
        // it triggers synchronously inside tryPlaceBuilding itself (e.g.
        // underground_belt.js's own tunnel-pair cleanup) - see
        // ActionHistory's class doc. Every caller (a single click, one tile
        // of a Bresenham drag, a direction-locked placement, an overview-zoom
        // tap) gets undo/redo for free this way, with nothing extra to wrap
        // at each call site.
        this.root.actionHistory.beginTransaction();
        const entity = this.root.logic.tryPlaceBuilding({
            origin: tile,
            rotation,
            rotationVariant,
            originalRotation: this.currentBaseRotation,
            building: this.currentMetaBuilding.get(),
            variant: this.currentVariant.get(),
        });
        this.root.actionHistory.endTransaction();

        if (entity) {
            // Succesfully placed, find which entity we actually placed
            this.root.signals.entityManuallyPlaced.dispatch(entity);

            if (this.movedBuildingCut) {
                // A confirmed transform (item 4) is a deliberate choice, not
                // something left to revert any more (see abortPlacement) -
                // collapse the pickup's delete and this placement into a
                // single undo step, mirroring mobile's placeSingle.
                this.root.actionHistory.combineLastTwo();
                this.movedBuildingCut = false;
            }

            // Check if we should flip the orientation (used for tunnels)
            if (
                metaBuilding.getFlipOrientationAfterPlacement() &&
                !this.root.keyMapper.getBinding(
                    KEYMAPPINGS.placementModifiers.placementDisableAutoOrientation
                ).pressed
            ) {
                this.currentBaseRotation = (180 + this.currentBaseRotation) % 360;
            }

            // Check if we should stop placement
            if (
                !metaBuilding.getStayInPlacementMode() &&
                !this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.placeMultiple).pressed &&
                !this.root.app.settings.getAllSettings().alwaysMultiplace
            ) {
                // Stop placement
                this.currentMetaBuilding.set(null);
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Cycles through the variants
     * @param {number=} direction Overrides the direction instead of reading it from the modifier key
     */
    cycleVariants(direction) {
        const metaBuilding = this.currentMetaBuilding.get();
        if (!metaBuilding) {
            this.currentVariant.set(defaultBuildingVariant);
        } else {
            const availableVariants = metaBuilding.getAvailableVariants(this.root);
            let index = availableVariants.indexOf(this.currentVariant.get());
            if (index < 0) {
                index = 0;
                console.warn("Invalid variant selected:", this.currentVariant.get());
            }
            if (!direction) {
                direction = this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateInverseModifier)
                    .pressed
                    ? -1
                    : 1;
            }

            const newIndex = safeModulo(index + direction, availableVariants.length);
            const newVariant = availableVariants[newIndex];
            this.setVariant(newVariant);
        }
    }

    /**
     * Sets the current variant to the given variant
     * @param {string} variant
     */
    setVariant(variant) {
        const metaBuilding = this.currentMetaBuilding.get();
        this.currentVariant.set(variant);

        this.preferredVariants[metaBuilding.getId()] = variant;
    }

    /**
     * Performs the direction locked placement between two points after
     * releasing the mouse
     */
    executeDirectionLockedPlacement() {
        const metaBuilding = this.currentMetaBuilding.get();
        if (!metaBuilding) {
            // No active building
            return;
        }

        // Get path to place
        const path = this.computeDirectionLockPath();

        // Store if we placed anything
        let anythingPlaced = false;

        // Perform this in bulk to avoid recalculations
        this.root.logic.performBulkOperation(() => {
            for (let i = 0; i < path.length; ++i) {
                const { rotation, tile } = path[i];
                this.currentBaseRotation = rotation;
                if (this.tryPlaceCurrentBuildingAt(tile)) {
                    anythingPlaced = true;
                }
            }
        });

        if (anythingPlaced) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
        }
    }

    /**
     * Finds the path which the current direction lock will use
     * @returns {Array<{ tile: Vector, rotation: number }>}
     */
    computeDirectionLockPath() {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return [];
        }

        let result = [];

        // Figure which points the line visits
        const worldPos = this.root.camera.screenToWorld(mousePosition);
        let endTile = worldPos.toTileSpace();
        let startTile = this.lastDragTile;

        // if the alt key is pressed, reverse belt planner direction by switching start and end tile
        if (this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.placeInverse).pressed) {
            let tmp = startTile;
            startTile = endTile;
            endTile = tmp;
        }

        // Place from start to corner
        const pathToCorner = this.currentDirectionLockCorner.sub(startTile);
        const deltaToCorner = pathToCorner.normalize().round();
        const lengthToCorner = Math.round(pathToCorner.length());
        let currentPos = startTile.copy();

        let rotation = (Math.round(Math.degrees(deltaToCorner.angle()) / 90) * 90 + 360) % 360;

        if (lengthToCorner > 0) {
            for (let i = 0; i < lengthToCorner; ++i) {
                result.push({
                    tile: currentPos.copy(),
                    rotation,
                });
                currentPos.addInplace(deltaToCorner);
            }
        }

        // Place from corner to end
        const pathFromCorner = endTile.sub(this.currentDirectionLockCorner);
        const deltaFromCorner = pathFromCorner.normalize().round();
        const lengthFromCorner = Math.round(pathFromCorner.length());

        if (lengthFromCorner > 0) {
            rotation = (Math.round(Math.degrees(deltaFromCorner.angle()) / 90) * 90 + 360) % 360;
            for (let i = 0; i < lengthFromCorner + 1; ++i) {
                result.push({
                    tile: currentPos.copy(),
                    rotation,
                });
                currentPos.addInplace(deltaFromCorner);
            }
        } else {
            // Finish last one
            result.push({
                tile: currentPos.copy(),
                rotation,
            });
        }
        return result;
    }

    /**
     * Selects a given building
     * @param {MetaBuilding} metaBuilding
     */
    startSelection(metaBuilding) {
        this.currentMetaBuilding.set(metaBuilding);
    }

    /**
     * Called when the selected buildings changed
     * @param {MetaBuilding} metaBuilding
     */
    onSelectedMetaBuildingChanged(metaBuilding) {
        this.abortDragging();
        if (!metaBuilding || metaBuilding.getId() !== "belt") {
            // Leaving belt (or deselecting entirely) starts the next belt
            // fresh, same as mobile's default (non-"new belt button") behavior.
            this.lastBeltTile = null;
            this.lastBeltIncomingDirection = undefined;
        }
        this.root.hud.signals.selectedPlacementBuildingChanged.dispatch(metaBuilding);
        if (metaBuilding) {
            const availableVariants = metaBuilding.getAvailableVariants(this.root);
            const preferredVariant = this.preferredVariants[metaBuilding.getId()];

            // Choose last stored variant if possible, otherwise the default one
            let variant;
            if (!preferredVariant || !availableVariants.includes(preferredVariant)) {
                variant = availableVariants[0];
            } else {
                variant = preferredVariant;
            }

            this.currentVariant.set(variant);

            this.fakeEntity = new Entity(null);
            metaBuilding.setupEntityComponents(this.fakeEntity, null);

            this.fakeEntity.addComponent(
                new StaticMapEntityComponent({
                    origin: new Vector(0, 0),
                    rotation: 0,
                    tileSize: metaBuilding.getDimensions(this.currentVariant.get()).copy(),
                    code: getCodeFromBuildingData(metaBuilding, variant, 0),
                })
            );
            metaBuilding.updateVariants(this.fakeEntity, 0, this.currentVariant.get());
        } else {
            this.fakeEntity = null;
        }

        // Since it depends on both, rerender twice
        this.signals.variantChanged.dispatch();
    }

    /**
     * mouse down pre handler
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        if (this.root.camera.getIsMapOverlayActive()) {
            // Placement keeps working zoomed out into map overview, same as
            // mobile (see OverviewBuildingPolicy's doc) - but only as a
            // discrete click, not a drag (see placeBeltTapAt's doc for why),
            // and deletion/variant-cycling stay blocked exactly like before.
            const metaBuilding = this.currentMetaBuilding.get();
            if (button !== enumMouseButton.left || !metaBuilding || !this.overviewBuildingPolicy.isAllowed()) {
                return;
            }
            const tile = this.root.camera.screenToWorld(pos).toTileSpace();
            if (this.isBeltSelected) {
                this.placeBeltTapAt(tile);
            } else if (this.tryPlaceCurrentBuildingAt(tile)) {
                this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
            }
            return STOP_PROPAGATION;
        }

        const metaBuilding = this.currentMetaBuilding.get();

        // Switch variant with shift + right click
        if (
            button === enumMouseButton.right &&
            metaBuilding &&
            this.root.keyMapper.getBinding(KEYMAPPINGS.placement.rotateInverseModifier).pressed
        ) {
            if (metaBuilding.getAvailableVariants(this.root).length > 1) {
                this.cycleVariants(1);
            }
            return STOP_PROPAGATION;
        }

        // Placement
        if (button === enumMouseButton.left && metaBuilding) {
            this.currentlyDragging = true;
            this.currentlyDeleting = false;
            this.lastDragTile = this.root.camera.screenToWorld(pos).toTileSpace();

            // Place initial building, but only if direction lock is not active
            if (!this.isDirectionLockActive) {
                if (this.tryPlaceCurrentBuildingAt(this.lastDragTile)) {
                    this.root.soundProxy.playUi(metaBuilding.getPlacementSound());

                    // Item 9 (normal zoom): this anchor tile is a genuine
                    // belt placement too, same as any tap-continuation or
                    // drag commit below - keep lastBeltTile up to date so a
                    // later click while zoomed into map overview continues
                    // from here (placeBeltTapAt) instead of starting a fresh,
                    // disconnected segment. Previously only overview clicks
                    // ever wrote this, so normal-zoom activity was invisible
                    // to it.
                    if (this.isBeltSelected) {
                        this.lastBeltTile = this.lastDragTile;
                        this.lastBeltIncomingDirection = this.root.map.getLayerContentXY(
                            this.lastDragTile.x,
                            this.lastDragTile.y,
                            "regular"
                        )?.components.StaticMapEntity.rotation;
                    }
                }

                // Item 9: belt drags from here on are a preview committed on
                // release (see beltDragStartTile's doc) instead of the
                // ordinary real-time Bresenham loop below - the anchor tile
                // itself is already placed above, same as any other building.
                if (this.isBeltSelected) {
                    this.beltDragStartTile = this.lastDragTile;
                    this.beltDragPath = [this.lastDragTile];
                    this.beltDragPreviewEntries = [];
                    this.beltDragPreviewInvalid = false;
                }
            }
            return STOP_PROPAGATION;
        }

        // Deletion
        if (
            button === enumMouseButton.right &&
            (!metaBuilding || !this.root.app.settings.getAllSettings().clearCursorOnDeleteWhilePlacing)
        ) {
            this.currentlyDragging = true;
            this.currentlyDeleting = true;
            this.lastDragTile = this.root.camera.screenToWorld(pos).toTileSpace();
            if (this.deleteBelowCursor()) {
                return STOP_PROPAGATION;
            }
        }

        // Cancel placement
        if (button === enumMouseButton.right && metaBuilding) {
            this.abortPlacement();
        }
    }

    /**
     * mouse move pre handler
     * @param {Vector} pos
     */
    onMouseMove(pos) {
        if (this.root.camera.getIsMapOverlayActive()) {
            return;
        }

        // Check for direction lock
        if (this.isDirectionLockActive) {
            return;
        }

        const metaBuilding = this.currentMetaBuilding.get();
        if ((metaBuilding || this.currentlyDeleting) && this.lastDragTile) {
            const oldPos = this.lastDragTile;
            let newPos = this.root.camera.screenToWorld(pos).toTileSpace();

            // Check if camera is moving, since then we do nothing
            if (this.root.camera.desiredCenter) {
                this.lastDragTile = newPos;
                return;
            }

            // Check if anything changed
            if (!oldPos.equals(newPos)) {
                if (!this.currentlyDeleting && this.isBeltSelected && this.beltDragStartTile) {
                    // Item 9: live auto-tunnel planning while dragging, trying
                    // the other L-corner too if the dominant-axis one can't be
                    // made contiguous - if neither works, show nothing here
                    // (draw() reads beltDragPreviewInvalid and tints
                    // beltDragPath red instead) so release-time feedback
                    // (flashInvalidBelt) isn't the only hint something's wrong.
                    const { path, resolved } = this.beltPathPlanner.findBeltPathToward(
                        this.beltDragStartTile,
                        newPos,
                        true,
                        null,
                        undefined,
                        oldPos
                    );
                    this.beltDragPath = path;
                    this.beltDragPreviewEntries = resolved || [];
                    this.beltDragPreviewInvalid = !resolved;
                } else {
                    // Automatic Direction
                    if (
                        metaBuilding &&
                        metaBuilding.getRotateAutomaticallyWhilePlacing(this.currentVariant.get()) &&
                        !this.root.keyMapper.getBinding(
                            KEYMAPPINGS.placementModifiers.placementDisableAutoOrientation
                        ).pressed
                    ) {
                        const delta = newPos.sub(oldPos);
                        const angleDeg = Math.degrees(delta.angle());
                        this.currentBaseRotation = (Math.round(angleDeg / 90) * 90 + 360) % 360;

                        // Holding alt inverts the placement
                        if (
                            this.root.keyMapper.getBinding(KEYMAPPINGS.placementModifiers.placeInverse).pressed
                        ) {
                            this.currentBaseRotation = (180 + this.currentBaseRotation) % 360;
                        }
                    }

                    // bresenham
                    let x0 = oldPos.x;
                    let y0 = oldPos.y;
                    let x1 = newPos.x;
                    let y1 = newPos.y;

                    var dx = Math.abs(x1 - x0);
                    var dy = Math.abs(y1 - y0);
                    var sx = x0 < x1 ? 1 : -1;
                    var sy = y0 < y1 ? 1 : -1;
                    var err = dx - dy;

                    let anythingPlaced = false;
                    let anythingDeleted = false;

                    while (this.currentlyDeleting || this.currentMetaBuilding.get()) {
                        if (this.currentlyDeleting) {
                            // Deletion
                            const contents = this.root.map.getLayerContentXY(x0, y0, this.root.currentLayer);
                            if (contents && !contents.queuedForDestroy && !contents.destroyed) {
                                this.root.actionHistory.beginTransaction();
                                const deleted = this.root.logic.tryDeleteBuilding(contents);
                                this.root.actionHistory.endTransaction();
                                if (deleted) {
                                    anythingDeleted = true;
                                }
                            }
                        } else {
                            // Placement
                            if (this.tryPlaceCurrentBuildingAt(new Vector(x0, y0))) {
                                anythingPlaced = true;
                            }
                        }

                        if (x0 === x1 && y0 === y1) break;
                        var e2 = 2 * err;
                        if (e2 > -dy) {
                            err -= dy;
                            x0 += sx;
                        }
                        if (e2 < dx) {
                            err += dx;
                            y0 += sy;
                        }
                    }

                    if (anythingPlaced) {
                        this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
                    }
                    if (anythingDeleted) {
                        this.root.soundProxy.playUi(SOUNDS.destroyBuilding);
                    }
                }
            }

            this.lastDragTile = newPos;
            return STOP_PROPAGATION;
        }
    }

    /**
     * Mouse up handler
     */
    onMouseUp() {
        if (this.root.camera.getIsMapOverlayActive()) {
            return;
        }

        // Check for direction lock
        if (this.lastDragTile && this.currentlyDragging && this.isDirectionLockActive) {
            this.executeDirectionLockedPlacement();
        }

        // Item 9: commit (or reject) a completed belt drag - see
        // beltDragStartTile's doc.
        if (this.currentlyDragging && this.beltDragStartTile && this.beltDragPath.length > 1) {
            if (this.beltDragPreviewInvalid) {
                // Crosses an obstacle no unlocked tunnel can bridge - flash it
                // red instead of placing a gapped/broken belt.
                this.flashInvalidBelt(this.beltDragPath);
            } else if (this.beltDragPreviewEntries.length > 0) {
                const releaseWasOccupied = !!this.root.map.getLayerContentXY(
                    this.lastDragTile.x,
                    this.lastDragTile.y,
                    "regular"
                );
                const result = this.beltPathPlanner.placePath(this.beltDragPreviewEntries, {
                    tile: this.lastBeltTile,
                    incoming: this.lastBeltIncomingDirection,
                });
                this.applyBeltContinuation(result, releaseWasOccupied);
            }
        }

        this.abortDragging();
    }

    /**
     * Draws green/red arrows over the ghost's input and output slots showing
     * which will connect to a neighbor once placed - shared by desktop
     * (HUDBuildingPlacer.drawRegularPlacement) and mobile
     * (HUDMobileControls.drawBlueprintGhost) so both ghosts show the same
     * per-slot feedback, not just overall placeability.
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    drawMatchingAcceptorsAndEjectors(parameters) {
        const acceptorComp = this.fakeEntity.components.ItemAcceptor;
        const ejectorComp = this.fakeEntity.components.ItemEjector;
        const staticComp = this.fakeEntity.components.StaticMapEntity;
        const beltComp = this.fakeEntity.components.Belt;
        const minerComp = this.fakeEntity.components.Miner;

        const goodArrowSprite = Loader.getSprite("sprites/misc/slot_good_arrow.png");
        const badArrowSprite = Loader.getSprite("sprites/misc/slot_bad_arrow.png");

        // Just ignore the following code please ... thanks!

        const offsetShift = 10;

        /**
         * @type {Array<import("../../components/item_acceptor").ItemAcceptorSlot>}
         */
        let acceptorSlots = [];
        /**
         * @type {Array<import("../../components/item_ejector").ItemEjectorSlot>}
         */
        let ejectorSlots = [];

        if (ejectorComp) {
            ejectorSlots = ejectorComp.slots.slice();
        }

        if (acceptorComp) {
            acceptorSlots = acceptorComp.slots.slice();
        }

        if (beltComp) {
            const fakeEjectorSlot = beltComp.getFakeEjectorSlot();
            const fakeAcceptorSlot = beltComp.getFakeAcceptorSlot();
            ejectorSlots.push(fakeEjectorSlot);
            acceptorSlots.push(fakeAcceptorSlot);
        }

        // Go over all slots
        for (let i = 0; i < acceptorSlots.length; ++i) {
            const slot = acceptorSlots[i];

            const acceptorSlotWsTile = staticComp.localTileToWorld(slot.pos);
            const acceptorSlotWsPos = acceptorSlotWsTile.toWorldSpaceCenterOfTile();

            const direction = slot.direction;
            const worldDirection = staticComp.localDirectionToWorld(direction);

            // Figure out which tile ejects to this slot
            const sourceTile = acceptorSlotWsTile.add(enumDirectionToVector[worldDirection]);

            let isBlocked = false;
            let isConnected = false;

            // Find entity which is on that tile
            const sourceEntity = this.root.map.getLayerContentXY(
                sourceTile.x,
                sourceTile.y,
                this.fakeEntity.layer
            );

            // Check for the entity:
            if (sourceEntity) {
                const sourceEjector = sourceEntity.components.ItemEjector;
                const sourceBeltComp = sourceEntity.components.Belt;
                const sourceStaticComp = sourceEntity.components.StaticMapEntity;
                const ejectorAcceptLocalTile = sourceStaticComp.worldToLocalTile(acceptorSlotWsTile);

                // If this entity is on the same layer as the slot - if so, it can either be
                // connected, or it can not be connected and thus block the input
                if (sourceEjector && sourceEjector.anySlotEjectsToLocalTile(ejectorAcceptLocalTile)) {
                    // This one is connected, all good
                    isConnected = true;
                } else if (
                    sourceBeltComp &&
                    sourceStaticComp.localDirectionToWorld(sourceBeltComp.direction) ===
                        enumInvertedDirections[worldDirection]
                ) {
                    // Belt connected
                    isConnected = true;
                } else {
                    // This one is blocked
                    isBlocked = true;
                }
            }

            const alpha = isConnected || isBlocked ? 1.0 : 0.3;
            const sprite = isBlocked ? badArrowSprite : goodArrowSprite;

            parameters.context.globalAlpha = alpha;
            drawRotatedSprite({
                parameters,
                sprite,
                x: acceptorSlotWsPos.x,
                y: acceptorSlotWsPos.y,
                angle: Math.radians(enumDirectionToAngle[enumInvertedDirections[worldDirection]]),
                size: 13,
                offsetY: offsetShift + 13,
            });
            parameters.context.globalAlpha = 1;
        }

        // Go over all slots
        for (let ejectorSlotIndex = 0; ejectorSlotIndex < ejectorSlots.length; ++ejectorSlotIndex) {
            const slot = ejectorSlots[ejectorSlotIndex];

            const ejectorSlotLocalTile = slot.pos.add(enumDirectionToVector[slot.direction]);
            const ejectorSlotWsTile = staticComp.localTileToWorld(ejectorSlotLocalTile);

            const ejectorSLotWsPos = ejectorSlotWsTile.toWorldSpaceCenterOfTile();
            const ejectorSlotWsDirection = staticComp.localDirectionToWorld(slot.direction);

            let isBlocked = false;
            let isConnected = false;

            // Find entity which is on that tile
            const destEntity = this.root.map.getLayerContentXY(
                ejectorSlotWsTile.x,
                ejectorSlotWsTile.y,
                this.fakeEntity.layer
            );

            // Check for the entity:
            if (destEntity) {
                const destAcceptor = destEntity.components.ItemAcceptor;
                const destStaticComp = destEntity.components.StaticMapEntity;
                const destMiner = destEntity.components.Miner;

                const destLocalTile = destStaticComp.worldToLocalTile(ejectorSlotWsTile);
                const destLocalDir = destStaticComp.worldDirectionToLocal(ejectorSlotWsDirection);
                if (destAcceptor && destAcceptor.findMatchingSlot(destLocalTile, destLocalDir)) {
                    // This one is connected, all good
                    isConnected = true;
                } else if (destEntity.components.Belt && destLocalDir === enumDirection.top) {
                    // Connected to a belt
                    isConnected = true;
                } else if (minerComp && minerComp.chainable && destMiner && destMiner.chainable) {
                    // Chainable miners connected to eachother
                    isConnected = true;
                } else {
                    // This one is blocked
                    isBlocked = true;
                }
            }

            const alpha = isConnected || isBlocked ? 1.0 : 0.3;
            const sprite = isBlocked ? badArrowSprite : goodArrowSprite;

            parameters.context.globalAlpha = alpha;
            drawRotatedSprite({
                parameters,
                sprite,
                x: ejectorSLotWsPos.x,
                y: ejectorSLotWsPos.y,
                angle: Math.radians(enumDirectionToAngle[ejectorSlotWsDirection]),
                size: 13,
                offsetY: offsetShift,
            });
            parameters.context.globalAlpha = 1;
        }
    }
}
