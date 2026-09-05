import { MAX_MOVE_DISTANCE_PX } from "../../../core/click_detector";
import { globalConfig } from "../../../core/config";
import { STOP_PROPAGATION } from "../../../core/signal";
import { makeDiv } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { SOUNDS } from "../../../platform/sound";
import { getBuildingDataFromCode, getCodeFromBuildingData } from "../../building_codes";
import { enumMouseButton } from "../../camera";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { Entity } from "../../entity";
import { defaultBuildingVariant } from "../../meta_building";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { BaseHUDPart } from "../base_hud_part";
import { BeltPathPlanner } from "./belt_path_planner";
import { OverviewBuildingPolicy } from "./overview_building";

// How long a finger has to stay down before it counts as "hold" (start laying a
// belt path) instead of "move" (pan the map) or "tap" (place a single tile).
const LONG_PRESS_MS = 350;

/**
 * @typedef {{ tile: Vector, rotation: number, rotationVariant: number, isTunnel?: boolean, tunnelVariant?: string }} PathEntry
 */

/**
 * Touch controls for building placement.
 *
 * Belt placement mechanics are unchanged from the original mobile design:
 * holding and dragging lays a path, previewed live as a semi-transparent copy
 * of the real sprite, committed all at once on release (see
 * beginDrag/placePath) - it places immediately, with no confirm step. A plain
 * tap places a single tile immediately - unless a belt tile already exists
 * somewhere, in which case every tap after the first instead continues the
 * belt from there to the newly tapped tile (see placeBeltTapAt), so a very
 * long belt can be built one tap at a time without needing to drag precisely
 * across the whole visible map. Because it places immediately, belt's control
 * row only has undo (for correcting a mistake) and cancel - no confirm/
 * rotate/variant/copy, none of which apply to it (see the "blueprintMode"
 * class toggled in onPlacementBuildingChanged, and its comment on
 * createElements' buildingPreview panel below).
 *
 * Every other building instead uses a "blueprint" that follows the finger,
 * mirroring desktop's mouse-hover ghost preview - see onMouseDown/onMouseMove
 * below and drawBlueprintGhost. Touching the map (tap or drag) moves the
 * blueprint to/with the finger; nothing is actually built until the confirm
 * button is tapped.
 *
 * Auto-tunnel planning: any belt path (a drag or a tap-continuation) that
 * crosses an existing, non-belt-replaceable building - or a belt that isn't
 * touching the tile the path itself starts or ends on, see findBeltPath's
 * anchorTiles - is auto-bridged with a tunnel pair instead of just leaving a
 * gap there, if an unlocked tunnel tier's range covers it - see
 * findBeltPath. A belt the path starts *or* ends on (dragging/tapping
 * from one belt to another) is never tunnelled, just reshaped to connect the
 * two. If a genuine crossing can't be bridged (too
 * long a gap, tunnels not unlocked yet, or the blocked run isn't a single
 * straight line), nothing is placed and the attempted path flashes red
 * instead (flashInvalidBelt) - this is mobile's default belt behavior,
 * always on, unlike desktop's equivalent (planned as a Shift-drag modifier,
 * not implemented yet - desktop's belt-drag is a real-time immediate-Bresenham
 * placement loop in building_placer_logic.js, architecturally different
 * enough from this preview-then-commit-on-release model that it needs its
 * own integration pass rather than sharing this one directly).
 */
export class HUDMobileControls extends BaseHUDPart {
    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_MobileControls");

        // Idle state (nothing selected for placement): just a trash icon, sharing
        // the free space to the right of the toolbar that the preview panel below
        // takes over once a building is selected.
        this.deleteButton = document.createElement("button");
        this.deleteButton.classList.add("delete");
        this.element.appendChild(this.deleteButton);
        this.trackClicks(this.deleteButton, this.onDeleteClicked);

        // Item 3: tap to enter pipette mode, then tap a placed building to
        // pick up its type (without touching the original) - see
        // onPipetteClicked/onMouseDown.
        this.pipetteButton = document.createElement("button");
        this.pipetteButton.classList.add("pipette");
        this.element.appendChild(this.pipetteButton);
        this.trackClicks(this.pipetteButton, this.onPipetteClicked);

        this.undoButton = document.createElement("button");
        this.undoButton.classList.add("undo", "disabled");
        this.element.appendChild(this.undoButton);
        this.trackClicks(this.undoButton, this.onUndoClicked);

        this.redoButton = document.createElement("button");
        this.redoButton.classList.add("redo", "disabled");
        this.element.appendChild(this.redoButton);
        this.trackClicks(this.redoButton, this.onRedoClicked);

        // Item 1: toggles between the regular and wires layers - hidden
        // until wires are unlocked (see update()), same reward gate
        // switchLayers itself uses on desktop.
        this.layersButton = document.createElement("button");
        this.layersButton.classList.add("layers");
        this.element.appendChild(this.layersButton);
        this.trackClicks(this.layersButton, this.onLayersClicked);

        // Enters select mode (2c-5, item 2) - tap/drag on the map then
        // selects buildings (via the shared HUDMassSelector, see
        // onMouseDown/onMouseUp) instead of placing or panning.
        this.selectButton = document.createElement("button");
        this.selectButton.classList.add("select");
        this.element.appendChild(this.selectButton);
        this.trackClicks(this.selectButton, this.onSelectClicked);

        // Select mode's own control row (eraser/broom/cancel), shown instead
        // of the idle row while selectModeActive - see the "selecting" class
        // toggle in update().
        this.selectPanel = makeDiv(this.element, null, ["selectPanel"]);

        // Bundles the selection into a blueprint (reuses
        // HUDMassSelector.startCopy - same "blueprints not unlocked" dialog
        // desktop's own copy/cut already shows) and switches into
        // blueprintPanel below to place it - see onCopyClicked.
        this.copyButton = document.createElement("button");
        this.copyButton.classList.add("copy");
        this.selectPanel.appendChild(this.copyButton);
        this.trackClicks(this.copyButton, this.onCopyClicked);

        // Saves the selection straight into the Blueprint Library (desktop
        // equivalent: KEYMAPPINGS.massSelect.saveSelectionToLibrary) -
        // there's no keyboard here to hold a modifier for a second copy
        // action, so it gets its own button next to copy.
        this.saveToLibraryButton = document.createElement("button");
        this.saveToLibraryButton.classList.add("saveToLibrary");
        this.selectPanel.appendChild(this.saveToLibraryButton);
        this.trackClicks(this.saveToLibraryButton, this.onSaveToLibraryClicked);

        this.eraserButton = document.createElement("button");
        this.eraserButton.classList.add("eraser");
        this.selectPanel.appendChild(this.eraserButton);
        this.trackClicks(this.eraserButton, this.onEraserClicked);

        this.broomButton = document.createElement("button");
        this.broomButton.classList.add("broom");
        this.selectPanel.appendChild(this.broomButton);
        this.trackClicks(this.broomButton, this.onBroomClicked);

        this.selectCancelButton = document.createElement("button");
        this.selectCancelButton.classList.add("cancel");
        this.selectPanel.appendChild(this.selectCancelButton);
        this.trackClicks(this.selectCancelButton, this.onSelectCancelClicked);

        // Copied-blueprint placement row (confirm/rotate/cancel), shown
        // instead of every other row while blueprintPlacer.currentBlueprint
        // is set - see onCopyClicked/update().
        this.blueprintPanel = makeDiv(this.element, null, ["blueprintPanel"]);

        this.blueprintConfirmButton = document.createElement("button");
        this.blueprintConfirmButton.classList.add("confirm");
        this.blueprintPanel.appendChild(this.blueprintConfirmButton);
        this.trackClicks(this.blueprintConfirmButton, this.onBlueprintConfirmClicked);

        this.blueprintRotateButton = document.createElement("button");
        this.blueprintRotateButton.classList.add("rotate");
        this.blueprintPanel.appendChild(this.blueprintRotateButton);
        this.trackClicks(this.blueprintRotateButton, this.onBlueprintRotateClicked);

        this.blueprintCancelButton = document.createElement("button");
        this.blueprintCancelButton.classList.add("cancel");
        this.blueprintPanel.appendChild(this.blueprintCancelButton);
        this.trackClicks(this.blueprintCancelButton, this.onBlueprintCancelClicked);

        // Active state: a flat row of square control icons, shown above the
        // toolbar while a building is selected - which icons depend on the
        // "blueprintMode" class (see onPlacementBuildingChanged). Belt places
        // immediately (drag or tap) with no confirm step and no meaningful
        // multiplace toggle (it never leaves placement mode anyway), so it
        // only needs undo (in case that immediate placement was a mistake)
        // and cancel; every other building gets the full confirm/rotate/
        // variant/copy/cancel row for its blueprint (see drawBlueprintGhost).
        this.previewPanel = makeDiv(this.element, null, ["buildingPreview"]);

        this.cancelButton = document.createElement("button");
        this.cancelButton.classList.add("cancel");
        this.previewPanel.appendChild(this.cancelButton);
        this.trackClicks(this.cancelButton, this.onCancelClicked);

        // Belt mode only.
        this.beltUndoButton = document.createElement("button");
        this.beltUndoButton.classList.add("undo");
        this.previewPanel.appendChild(this.beltUndoButton);
        this.trackClicks(this.beltUndoButton, this.onUndoClicked);

        // Belt mode only: detaches from the current belt (same effect as
        // cancel + reselecting belt from the toolbar) without actually
        // leaving placement mode, so the next tap starts a brand new,
        // unconnected segment elsewhere instead of continuing this one.
        this.newBeltButton = document.createElement("button");
        this.newBeltButton.classList.add("newBelt");
        this.previewPanel.appendChild(this.newBeltButton);
        this.trackClicks(this.newBeltButton, this.onNewBeltClicked);

        // Blueprint mode only: places the blueprint at its current tile.
        this.confirmButton = document.createElement("button");
        this.confirmButton.classList.add("confirm");
        this.previewPanel.appendChild(this.confirmButton);
        this.trackClicks(this.confirmButton, this.onConfirmClicked);

        this.rotateButton = document.createElement("button");
        this.rotateButton.classList.add("rotate");
        this.previewPanel.appendChild(this.rotateButton);
        this.trackClicks(this.rotateButton, this.onRotateClicked);

        // Cycles variants - the badge shows how many there are, hidden
        // entirely for a building with only one (see renderPreview).
        this.variantButton = document.createElement("button");
        this.variantButton.classList.add("variant");
        this.variantBadge = makeDiv(this.variantButton, null, ["badge"]);
        this.previewPanel.appendChild(this.variantButton);
        this.trackClicks(this.variantButton, this.onVariantClicked);

        this.multiplaceButton = document.createElement("button");
        this.multiplaceButton.classList.add("multiplace");
        this.previewPanel.appendChild(this.multiplaceButton);
        this.trackClicks(this.multiplaceButton, this.onMultiplaceClicked);
    }

    initialize() {
        this.lastToolbarOffsetCheck = 0;

        this.beltPathPlanner = new BeltPathPlanner(this.root);
        this.overviewBuildingPolicy = new OverviewBuildingPolicy(this.root);

        this.deleteModeActive = false;

        // Item 3: true after tapping the pipette icon, until the next map
        // tap (which picks up whatever's there, or nothing) - see
        // onPipetteClicked/onMouseDown.
        this.pipetteModeActive = false;

        // 2c-5 (item 2): tap-to-select / drag-to-rubber-band-select, driven
        // directly through the desktop HUDMassSelector's own state/rendering
        // (see the massSelector getter and onMouseDown/onMouseMove/onMouseUp
        // below) - only its onMouseDown is gated behind a held-key binding
        // mobile has no equivalent of, so mobile drives
        // currentSelectionStartWorld/currentSelectionEnd itself and calls
        // its already-ungated onMouseUp() directly to commit.
        this.selectModeActive = false;

        // Long-press shortcut in view mode (nothing selected/deleting/
        // selecting) - a stationary hold on the map, dispatched by
        // beginIdleLongPress once it fires:
        //  - empty tile -> select mode, same as tapping the pencil icon.
        //  - a belt tile -> belt build mode, picking up right where that
        //    tile left off (same as tapping the belt icon then tapping this
        //    tile - see placeBeltTapAt/lastBeltTile).
        //  - any other building -> pick it up into the normal toolbar-select
        //    placement flow, same as tapping its icon (see
        //    beginMoveExistingBuilding).
        // Deliberately never stops propagation on the way here (see
        // onMouseDown/onMouseMove/onMouseUp) so it can't break a lever/
        // waypoint tap or the camera's own default pan - belt's own build-
        // mode hold (beginDrag) is a fully separate mechanism gated on a
        // building already being selected, so the two never run at the same
        // time.
        this.idleHoldPos = null;
        this.idleHoldTimer = null;

        // Copied-blueprint placement (multi-selection copy only, see
        // onCopyClicked): the tile the finger-follow ghost currently rests
        // at, once blueprintPlacer.currentBlueprint is set - mirrors
        // blueprintTile above but for a Blueprint object instead of a
        // MetaBuilding (desktop's HUDBlueprintPlacer only wires up real
        // mouse handlers, nothing touch-based, so mobile drives its
        // currentBlueprint/tryPlace/rotateCw/abortPlacement directly instead
        // of duplicating any of that).
        /** @type {Vector} */
        this.copiedBlueprintTile = null;

        // True while currentMetaBuilding stands in for a real building
        // long-pressed and picked up (beginMoveExistingBuilding already
        // deleted it), so cancelling the placement (onCancelClicked) should
        // restore the original with a plain undo() instead of just losing
        // it. Cleared the moment a confirm actually places somewhere, since
        // at that point the move is a deliberate choice, not something left
        // to revert.
        this.movedBuildingCut = false;

        // Persists across building selections, not per-building - a player
        // preference for how placing works, not a building property.
        this.multiplaceMode = false;

        this.dragging = false;
        this.dragStartTile = null;
        /** @type {Array<Vector>} */
        this.dragPath = [];
        /** @type {Array<PathEntry>} */
        this.dragPreviewEntries = [];
        // Set alongside dragPreviewEntries whenever findBeltPath (item 9's
        // auto-tunnel planning) can't make the currently-dragged path
        // contiguous - dragPreviewEntries is left empty and draw() shows a
        // red tint over dragPath instead of ghost belts.
        this.dragPreviewInvalid = false;

        // Item 9: a brief red flash over a just-rejected belt path (a tap or
        // a completed drag that findBeltPath couldn't make contiguous),
        // shown instead of placing anything. Cleared automatically in
        // update() once its duration elapses - see flashInvalidBelt.
        /** @type {{ path: Array<Vector>, startedAt: number }} */
        this.invalidBeltFlash = null;

        // Belt continuation: the tile the belt last ended at (from any
        // placement - a drag, a plain tap, or a previous continuation tap).
        // Once set, the next plain tap doesn't place a lone tile any more -
        // it lays a path from here to the tapped tile instead, same shape a
        // drag would (see placeBeltTapAt). Lets a long belt be built one tap
        // at a time, which matters at a zoomed-out scale where dragging
        // precisely across the whole visible map isn't practical. Persists
        // across zoom on its own - zooming doesn't touch currentMetaBuilding
        // or this field, only an explicit selection change resets it (see
        // onPlacementBuildingChanged).
        /** @type {Vector} */
        this.lastBeltTile = null;

        // The compass direction the belt actually flowed *into*
        // lastBeltTile from its own previous tile (undefined if
        // lastBeltTile is a lone tile with no such predecessor) - kept
        // alongside lastBeltTile so the next continuation's own first entry
        // (which physically overwrites this same tile) can still curve
        // smoothly from that true incoming direction, the same way it did
        // when this tile was originally placed. curvedEntry has no other way
        // to know this: from a brand-new path's own point of view this tile
        // is just its unconnected starting point, with nothing "before" it.
        /** @type {number=} */
        this.lastBeltIncomingDirection = undefined;

        // Blueprint mode (non-belt buildings): the tile the ghost preview is
        // currently resting at, moved by touch on the map, placed only via
        // the explicit confirm button - see onMouseDown/onMouseMove below.
        /** @type {Vector} */
        this.blueprintTile = null;
        this.draggingBlueprint = false;

        // "pending" state: finger is down but we haven't decided yet whether this is
        // a tap, a pan, or the start of a held drag.
        this.pendingPos = null;
        this.pendingTile = null;
        this.holdTimer = null;
        this.panning = false;
        this.lastPanPos = null;

        // addToTop + STOP_PROPAGATION so this runs before (and instead of)
        // HUDBuildingPlacerLogic's own immediate-placement handlers.
        this.root.camera.downPreHandler.addToTop(this.onMouseDown, this);
        this.root.camera.movePreHandler.addToTop(this.onMouseMove, this);
        this.root.camera.upPostHandler.addToTop(this.onMouseUp, this);

        this.root.hud.signals.selectedPlacementBuildingChanged.add(this.onPlacementBuildingChanged, this);
        // Not selectedPlacementBuildingChanged - that fires before the placer logic
        // has actually settled on a variant/fakeEntity for the new building, same
        // reason HUDBuildingPlacer.rerenderVariants hooks this one instead.
        this.placerLogic.signals.variantChanged.add(this.renderPreview, this);

        // Camera handles a 2nd finger as a pinch-zoom entirely on its own (doesn't go
        // through downPreHandler/movePreHandler at all), so our pending-hold/drag
        // state never otherwise finds out a second finger joined - left alone, a
        // still-running hold timer from the first finger fires mid-pinch and places
        // a building under where that finger happened to be.
        this.cancelGestureOnSecondTouch = event => {
            if (event.touches && event.touches.length >= 2) {
                this.clearPendingHold();
                this.clearIdleHold();
                this.dragging = false;
                this.dragPath = [];
                this.dragPreviewEntries = [];
                this.dragPreviewInvalid = false;
                this.panning = false;
                this.draggingBlueprint = false;
                // A second finger joining mid rubber-band means this was
                // actually the start of a pinch/pan, not a selection drag -
                // abort without committing (never call massSelector's own
                // onMouseUp here), otherwise it stays frozen on screen for
                // the rest of the pinch and then wrongly selects whatever
                // was under the first finger the moment fingers lift.
                if (this.selectModeActive) {
                    this.massSelector.currentSelectionStartWorld = null;
                    this.massSelector.currentSelectionEnd = null;
                }
            }
        };
        this.root.canvas.addEventListener("touchstart", this.cancelGestureOnSecondTouch);
    }

    onPlacementBuildingChanged(metaBuilding) {
        if (metaBuilding) {
            this.deleteModeActive = false;
            this.deleteButton.classList.remove("active");
            this.exitSelectMode();
            this.exitPipetteMode();
            this.exitCopiedBlueprintMode();
            this.clearIdleHold();
            // No manual toggle for this on mobile (no room for one more button) -
            // it just always shows unless the player turned it off in settings.
            // Still a CSS class toggle rather than a Dialog: HUDBuildingPlacerLogic
            // .update() aborts the current placement the instant HUDModalDialogs
            // reports a blocking overlay open, so a real modal here would silently
            // deselect the building the moment it appeared.
            this.placementHintsElement.classList.toggle(
                "mobileVisible",
                this.root.app.settings.getAllSettings().alwaysShowBuildingInfo
            );

            const isBlueprintMode = !this.isBeltSelected;
            this.previewPanel.classList.toggle("blueprintMode", isBlueprintMode);
            if (isBlueprintMode) {
                // Appears in the middle of the current view, not under a
                // finger - there's no touch on screen yet at selection time
                // (the building was just tapped in the toolbar, off-map).
                this.blueprintTile = this.root.camera.center.toTileSpace();
            } else {
                this.blueprintTile = null;
            }
        } else {
            // Nothing left to show info about.
            this.placementHintsElement.classList.remove("mobileVisible");
            this.previewPanel.classList.remove("blueprintMode");
            this.blueprintTile = null;
        }
        this.dragPreviewEntries = [];
        this.dragPreviewInvalid = false;
        this.invalidBeltFlash = null;
        this.dragPath = [];
        this.dragging = false;
        this.draggingBlueprint = false;
        this.lastBeltTile = null;
        this.lastBeltIncomingDirection = undefined;
        this.clearPendingHold();
        this.panning = false;
    }

    get placerLogic() {
        return this.root.hud.parts.buildingPlacer;
    }

    get massSelector() {
        return this.root.hud.parts.massSelector;
    }

    get blueprintPlacer() {
        return this.root.hud.parts.blueprintPlacer;
    }

    /**
     * A standalone fake entity for previewing tunnel pieces (see
     * drawPreviewEntry) - separate from this.placerLogic.fakeEntity, which
     * only ever has belt's own components (it's built for whatever building
     * is actually selected, always belt while any of this matters) and would
     * throw if a tunnel's updateVariants() tried to touch a
     * UndergroundBelt/ItemAcceptor/ItemEjector setup it doesn't have.
     * Constructed lazily, once - mirrors
     * HUDBuildingPlacerLogic.onSelectedMetaBuildingChanged's own fakeEntity
     * setup.
     */
    get tunnelFakeEntity() {
        if (!this._tunnelFakeEntity) {
            const building = this.beltPathPlanner.tunnelMetaBuilding;
            const entity = new Entity(null);
            building.setupEntityComponents(entity, null);
            entity.addComponent(
                new StaticMapEntityComponent({
                    origin: new Vector(0, 0),
                    rotation: 0,
                    tileSize: building.getDimensions(defaultBuildingVariant).copy(),
                    code: getCodeFromBuildingData(building, defaultBuildingVariant, 0),
                })
            );
            building.updateVariants(entity, 0, defaultBuildingVariant);
            this._tunnelFakeEntity = entity;
        }
        return this._tunnelFakeEntity;
    }

    // Not cached via document.getElementById at initialize() time - by then
    // HUDBuildingPlacer.initialize() has already wrapped this element in a
    // DynamicDomAttach, whose constructor immediately detaches it from the DOM
    // as its default state, so a getElementById lookup at that point finds
    // nothing. The live object reference works regardless of attach state.
    get placementHintsElement() {
        return this.placerLogic.element;
    }

    get isBeltSelected() {
        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        return !!metaBuilding && metaBuilding.getId() === "belt";
    }

    onRotateClicked() {
        this.placerLogic.tryRotate();
    }

    onMultiplaceClicked() {
        this.multiplaceMode = !this.multiplaceMode;
        this.multiplaceButton.classList.toggle("active", this.multiplaceMode);
    }

    onDeleteClicked() {
        this.deleteModeActive = !this.deleteModeActive;
        this.deleteButton.classList.toggle("active", this.deleteModeActive);
        if (this.deleteModeActive) {
            this.exitPipetteMode();
            this.placerLogic.currentMetaBuilding.set(null);
        }
    }

    /**
     * Item 3: toggles pipette mode - the next map tap picks up whatever
     * building is there (via HUDBuildingPlacerLogic.pipetteAt, shared with
     * desktop's Q-key pipette) instead of placing/deleting/selecting.
     */
    onPipetteClicked() {
        if (this.pipetteModeActive) {
            this.exitPipetteMode();
            return;
        }
        this.deleteModeActive = false;
        this.deleteButton.classList.remove("active");
        this.exitSelectMode();
        this.placerLogic.currentMetaBuilding.set(null);
        this.pipetteModeActive = true;
        this.pipetteButton.classList.add("active");
    }

    exitPipetteMode() {
        this.pipetteModeActive = false;
        this.pipetteButton.classList.remove("active");
    }

    /**
     * Item 1: toggles between the regular and wires layers - thin wrapper
     * over HUDWiresOverlay.switchLayers (shared with desktop's "E" key), so
     * the unlock check/editModeChanged dispatch only lives in one place.
     */
    onLayersClicked() {
        const wiresOverlay = this.root.hud.parts.wiresOverlay;
        if (wiresOverlay) {
            wiresOverlay.switchLayers();
        }
    }

    /**
     * Cancels the current toolbar-select placement - if it was started by
     * picking up an existing building via long-press (beginMoveExisting
     * Building already deleted the original), restores it instead of just
     * losing it.
     */
    onCancelClicked() {
        if (this.movedBuildingCut && this.root.actionHistory.canUndo) {
            this.root.actionHistory.undo();
        }
        this.movedBuildingCut = false;
        this.placerLogic.currentMetaBuilding.set(null);
    }

    /**
     * Toggles select mode (2c-5, item 2) on/off - see onMouseDown/onMouseUp
     * for the actual tap/drag-to-select handling.
     */
    onSelectClicked() {
        if (this.selectModeActive) {
            this.exitSelectMode();
            return;
        }
        this.deleteModeActive = false;
        this.deleteButton.classList.remove("active");
        this.exitPipetteMode();
        this.placerLogic.currentMetaBuilding.set(null);
        this.selectModeActive = true;
        this.selectButton.classList.add("active");
    }

    exitSelectMode() {
        this.selectModeActive = false;
        this.selectButton.classList.remove("active");
        if (this.massSelector) {
            this.massSelector.clearSelection();
        }
    }

    onSelectCancelClicked() {
        this.exitSelectMode();
    }

    clearIdleHold() {
        if (this.idleHoldTimer) {
            clearTimeout(this.idleHoldTimer);
            this.idleHoldTimer = null;
        }
        this.idleHoldPos = null;
    }

    /**
     * Fired after a stationary hold on the map in view mode - see
     * idleHoldPos's doc in initialize(). Branches on what's under the
     * finger: an empty tile enters select mode, a belt continues it, any
     * other building gets picked up into the normal placement flow (see
     * beginMoveExistingBuilding).
     */
    beginIdleLongPress() {
        this.idleHoldTimer = null;
        const pos = this.idleHoldPos;
        this.idleHoldPos = null;
        if (!pos) {
            return;
        }
        const tile = this.root.camera.screenToWorld(pos).toTileSpace();
        const contents = this.root.map.getTileContent(tile, this.root.currentLayer);

        if (!contents) {
            this.selectModeActive = true;
            this.selectButton.classList.add("active");
            this.massSelector.currentSelectionStartWorld = this.root.camera.screenToWorld(pos);
            this.massSelector.currentSelectionEnd = pos.copy();
            this.massSelector.onMouseUp();
            return;
        }

        const staticComp = contents.components.StaticMapEntity;
        const metaBuilding = staticComp.getMetaBuilding();
        if (metaBuilding.getId() === "belt") {
            // Picks up right where this tile left off - same as tapping the
            // belt icon then tapping this tile (see placeBeltTapAt).
            this.placerLogic.currentMetaBuilding.set(metaBuilding);
            this.lastBeltTile = tile;
            this.lastBeltIncomingDirection = staticComp.rotation;
            return;
        }

        this.beginMoveExistingBuilding(contents);
    }

    /**
     * Picks up an existing (non-belt) building via long-press and re-enters
     * it into the same toolbar-select placement flow a fresh building from
     * the toolbar uses (ghost preview with green/red slot arrows,
     * confirm/rotate/variant/cancel row - see onPlacementBuildingChanged/
     * drawBlueprintGhost) instead of the separate copied-blueprint
     * mechanism, which only makes sense for an actual multi-selection copy
     * (it shows a cost tag and a paste-many confirm loop, both wrong for
     * "move this one building"). Mirrors HUDBuildingPlacerLogic.
     * startPipette's code/variant extraction, but also deletes the
     * original - movedBuildingCut lets onCancelClicked restore it with a
     * plain undo() if the pickup is cancelled instead of confirmed.
     * @param {Entity} entity
     */
    beginMoveExistingBuilding(entity) {
        if (!this.root.logic.canDeleteBuilding(entity)) {
            // e.g. the hub - nothing to pick up.
            return;
        }
        const staticComp = entity.components.StaticMapEntity;
        const extracted = getBuildingDataFromCode(staticComp.code);
        const originTile = staticComp.origin.copy();
        const originRotation = staticComp.rotation;

        // tryDeleteBuilding only reports to actionHistory.noteEntityWillBeDeleted
        // (making it undoable) while a transaction is open - see ActionHistory's
        // class doc - so onCancelClicked's undo() needs this wrap to have
        // anything to restore.
        this.root.actionHistory.beginTransaction();
        const deleted = this.root.logic.tryDeleteBuilding(entity);
        this.root.actionHistory.endTransaction();
        if (!deleted) {
            return;
        }

        this.movedBuildingCut = true;
        this.placerLogic.currentMetaBuilding.set(extracted.metaInstance);
        this.placerLogic.currentVariant.set(extracted.variant);
        this.placerLogic.currentBaseRotation = originRotation;
        // onPlacementBuildingChanged (fired synchronously by the .set()
        // above) defaults blueprintTile to the camera center, since a
        // toolbar tap has no tile under it yet - override it to where the
        // building actually was so the ghost appears there instead.
        this.blueprintTile = originTile;
    }

    /**
     * Deletes everything currently selected, same confirm-dialog-past-100
     * behavior as desktop's mass delete - see HUDMassSelector.confirmDelete.
     */
    onEraserClicked() {
        this.massSelector.confirmDelete();
    }

    /**
     * Clears the item contents of every selected belt - see
     * HUDMassSelector.clearBelts.
     */
    onBroomClicked() {
        this.massSelector.clearBelts();
    }

    /**
     * Bundles the current selection into a blueprint (HUDMassSelector.
     * startCopy - shows the same "blueprints not unlocked" dialog or empty-
     * selection error sound desktop's own copy/cut already has) and, if that
     * actually produced one, switches from select mode into placing it.
     */
    onCopyClicked() {
        this.massSelector.startCopy();
        if (!this.blueprintPlacer.currentBlueprint.get()) {
            // Nothing selected, or blueprints not unlocked yet (dialog
            // already shown by startCopy) - stay in select mode.
            return;
        }
        this.enterCopiedBlueprintMode();
    }

    /**
     * Switches into the copied-blueprint placement row (confirm/rotate/
     * cancel) for whatever blueprint is currently armed on
     * blueprintPlacer.currentBlueprint - shared by onCopyClicked (mass-
     * select copy) and the blueprint library's EQUIP action, which arms a
     * blueprint the same way but skips mass-select entirely.
     */
    enterCopiedBlueprintMode() {
        this.selectModeActive = false;
        this.selectButton.classList.remove("active");
        this.copiedBlueprintTile = this.root.camera.center.toTileSpace();
    }

    /**
     * Opens the Blueprint Library's save dialog for the current mass
     * selection - stays in select mode afterward (unlike copy), so the
     * player can keep adjusting the selection or copy it too.
     */
    onSaveToLibraryClicked() {
        this.root.hud.parts.blueprintLibrary.trySaveSelection(Array.from(this.massSelector.selectedUids));
    }

    exitCopiedBlueprintMode() {
        if (this.copiedBlueprintTile) {
            this.blueprintPlacer.abortPlacement();
        }
        this.copiedBlueprintTile = null;
    }

    onBlueprintCancelClicked() {
        this.exitCopiedBlueprintMode();
    }

    onBlueprintRotateClicked() {
        const blueprint = this.blueprintPlacer.currentBlueprint.get();
        if (blueprint) {
            blueprint.rotateCw();
        }
    }

    /**
     * Places the copied blueprint at its current ghost tile - stays in
     * placement mode afterward (matches desktop: a pasted blueprint is
     * never consumed, see HUDBlueprintPlacer.onMouseDown), so confirm can be
     * tapped again to re-stamp it wherever the ghost has since moved to.
     */
    onBlueprintConfirmClicked() {
        const blueprint = this.blueprintPlacer.currentBlueprint.get();
        if (!blueprint || !this.copiedBlueprintTile) {
            return;
        }
        if (!blueprint.canAfford(this.root)) {
            this.root.soundProxy.playUiError();
            return;
        }
        this.root.actionHistory.beginTransaction();
        const placed = blueprint.tryPlace(this.root, this.copiedBlueprintTile);
        this.root.actionHistory.endTransaction();
        if (placed) {
            this.root.soundProxy.playUi(SOUNDS.placeBuilding);
            // A confirmed placement is a deliberate choice, not something
            // left to revert any more - see exitCopiedBlueprintMode's doc.
            this.movedBuildingCut = false;
        }
    }

    /**
     * Blueprint mode only: places the blueprint at its current tile - same
     * placeSingle() the old tap-to-place flow used, so multiplace-mode
     * reselection and the placement sound work identically.
     */
    onConfirmClicked() {
        if (!this.blueprintTile) {
            return;
        }
        this.placeSingle(this.blueprintTile, this.placerLogic.currentBaseRotation);
    }

    onVariantClicked() {
        this.placerLogic.cycleVariants(1);
    }

    onUndoClicked() {
        if (this.root.actionHistory.canUndo) {
            // If the undone command was a belt placement, its meta carries
            // where the belt ended *before* that placement - roll
            // lastBeltTile back to there so the next tap resumes from that
            // earlier point instead of either the (now undone) tile or
            // forgetting the belt entirely. Anything else (a non-belt
            // placement, a deletion) means lastBeltTile was already null
            // going in - see the class doc's reasoning in
            // onPlacementBuildingChanged - so null is the correct fallback.
            const meta = this.root.actionHistory.undo();
            this.lastBeltTile = meta ? meta.beltTileBefore : null;
            this.lastBeltIncomingDirection = meta ? meta.beltIncomingBefore : undefined;
        }
    }

    onRedoClicked() {
        if (this.root.actionHistory.canRedo) {
            // Mirror image of onUndoClicked - a redone belt placement's meta
            // carries the tile it ended at, so continuation resumes exactly
            // where undo had rolled it back from.
            const meta = this.root.actionHistory.redo();
            this.lastBeltTile = meta ? meta.beltTileAfter : null;
            this.lastBeltIncomingDirection = meta ? meta.beltIncomingAfter : undefined;
        }
    }

    /**
     * Belt mode only: detaches from the current belt without leaving
     * placement mode - the next tap starts a fresh, unconnected segment
     * elsewhere, same as tapping cancel and reselecting belt from the
     * toolbar, minus actually leaving placement mode in between.
     */
    onNewBeltClicked() {
        this.lastBeltTile = null;
        this.lastBeltIncomingDirection = undefined;
        this.invalidBeltFlash = null;
    }

    /**
     * Renders the selected building's actual sprite (not the flat toolbar icon)
     * into the preview panel, sized to its real tile footprint, and updates the
     * swipe hint's visibility depending on whether it has multiple variants.
     */
    renderPreview() {
        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding) {
            return;
        }
        const variantCount = metaBuilding.getAvailableVariants(this.root).length;
        this.previewPanel.classList.toggle("hasVariants", variantCount > 1);
        this.variantBadge.innerText = String(variantCount);
    }

    /**
     * Thin wrapper over BeltPathPlanner.findBeltPathToward - threads this
     * part's own continuation state (lastBeltTile/lastBeltIncomingDirection,
     * item 8's tap-to-extend) through automatically, so call sites don't
     * have to.
     * @param {Vector} from
     * @param {Vector} to
     * @param {boolean} allowReshape See BeltPathPlanner.findBeltPathSearch -
     * true for a drag, false for tap-continuation.
     * @param {Vector=} approachTile See BeltPathPlanner.findBeltPath.
     * @returns {{ path: Array<Vector>, resolved: Array<PathEntry>|null }}
     */
    findBeltPathToward(from, to, allowReshape, approachTile = null) {
        return this.beltPathPlanner.findBeltPathToward(
            from,
            to,
            allowReshape,
            this.lastBeltTile,
            this.lastBeltIncomingDirection,
            approachTile
        );
    }

    /**
     * Item 9: momentarily tints the given (unplaceable) tiles red instead of
     * placing anything - originally belt-only feedback for "a continuous
     * belt isn't possible here" (the gap is too long for any unlocked
     * tunnel tier, tunnels aren't unlocked, or the blocked run isn't a
     * straight enough line for a tunnel to bridge at all), reused by
     * placeSingle for "can't build here" on any other building's confirm
     * tap. Cleared automatically in update().
     * @param {Array<Vector>} path
     */
    flashInvalidBelt(path) {
        this.invalidBeltFlash = {
            path,
            startedAt: this.root.time.realtimeNow(),
        };
    }

    /**
     * Places a single building at the given tile/rotation immediately.
     * @param {Vector} tile
     * @param {number} rotation
     */
    placeSingle(tile, rotation) {
        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding) {
            return;
        }
        this.placerLogic.currentBaseRotation = rotation;
        // One transaction for this whole placement, including any side
        // effects other systems trigger off it (e.g. underground_belt.js
        // silently removing obsolete belts on a tunnel pair) - see
        // ActionHistory's class doc. Belt continuity (lastBeltTile) rides
        // along as transaction meta so undo/redo can roll it back/forward
        // in step with the map itself, see onUndoClicked/onRedoClicked.
        const beltTileBefore = this.lastBeltTile;
        const beltIncomingBefore = this.lastBeltIncomingDirection;
        this.root.actionHistory.beginTransaction();
        const placed = this.placerLogic.tryPlaceCurrentBuildingAt(tile);
        // A "fresh, unconnected" first tile still ends up with a real
        // incoming direction whenever the ordinary engine auto-rotation
        // (tryPlaceCurrentBuildingAt, same as any other building) curved it
        // toward a neighbour - a belt's own rotation always equals its
        // incoming direction, curved or not (see curvedEntry). Reading it
        // back off the map instead of assuming undefined is what lets a
        // later continuation tap preserve that curve instead of flattening
        // it back to a straight line.
        const beltIncomingAfter =
            placed && this.isBeltSelected
                ? this.root.map.getLayerContentXY(tile.x, tile.y, "regular").components.StaticMapEntity.rotation
                : undefined;
        this.root.actionHistory.endTransaction(
            this.isBeltSelected ? { beltTileBefore, beltTileAfter: tile, beltIncomingBefore, beltIncomingAfter } : null
        );
        if (placed) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
            // A confirmed placement is a deliberate choice, not something
            // left to revert any more - see beginMoveExistingBuilding/
            // onCancelClicked. Collapse the pickup's delete and this
            // placement into a single undo step, so one undo press goes
            // straight back to where it was picked up from.
            if (this.movedBuildingCut) {
                this.root.actionHistory.combineLastTwo();
            }
            this.movedBuildingCut = false;
            // Most buildings deselect themselves after one placement (unless they
            // "stay in placement mode", like belts always do) - multiplace mode
            // means "keep going", so reselect if that just happened.
            if (this.multiplaceMode && !this.placerLogic.currentMetaBuilding.get()) {
                this.placerLogic.currentMetaBuilding.set(metaBuilding);
            }
            if (this.isBeltSelected) {
                this.lastBeltTile = tile;
                this.lastBeltIncomingDirection = beltIncomingAfter;
            }
        } else {
            // Can't build here (obstructed, out of reach, etc) - same red
            // flash confirming a blocked belt drag already uses, so the
            // ghost's dimmed alpha isn't the only feedback something's wrong.
            this.root.soundProxy.playUiError();
            this.flashInvalidBelt([tile]);
        }
    }

    /**
     * Handles a plain tap (no drag) while belt is selected. The very first
     * tap just places one tile, same as any other building - but once a
     * belt tile exists (lastBeltTile set), every following tap continues
     * the belt from wherever it last ended to the newly tapped tile, laid
     * out the same L-shaped-corner way a held drag would (item 8: lets a
     * very long belt be built one tap at a time, which matters at a
     * zoomed-out scale where dragging precisely across the whole visible
     * map isn't practical).
     * @param {Vector} tile
     */
    placeBeltTapAt(tile) {
        if (this.lastBeltTile) {
            const { path, resolved } = this.findBeltPathToward(this.lastBeltTile, tile, false);
            if (!resolved) {
                // Item 9: crosses an obstacle no unlocked tunnel can bridge -
                // flash it red instead of placing a gapped/broken belt.
                this.flashInvalidBelt(path);
                return;
            }
            const releaseWasOccupied = !!this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
            this.placePath(resolved, releaseWasOccupied);
        } else {
            this.placeSingle(tile, this.placerLogic.currentBaseRotation);
        }
    }

    /**
     * Places every entry of a completed belt drag (or tap-continuation,
     * see placeBeltTapAt) immediately - thin wrapper over
     * BeltPathPlanner.placePath that threads this part's own continuation
     * state through and updates it from the result. If the drag/tap ended
     * on a tile that already had something there (a machine's input,
     * another belt trunk merged into, etc.), the run is done instead of
     * continued - same effect as tapping the "new belt" button
     * (onNewBeltClicked).
     * @param {Array<PathEntry>} entries
     * @param {boolean} releaseWasOccupied Whether the release tile already had map content *before* this placement.
     */
    placePath(entries, releaseWasOccupied) {
        const result = this.beltPathPlanner.placePath(entries, {
            tile: this.lastBeltTile,
            incoming: this.lastBeltIncomingDirection,
        });
        if (result.placed) {
            if (releaseWasOccupied) {
                this.lastBeltTile = null;
                this.lastBeltIncomingDirection = undefined;
            } else {
                this.lastBeltTile = result.lastTile;
                this.lastBeltIncomingDirection = result.lastIncoming;
            }
        }
    }

    clearPendingHold() {
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
        this.pendingPos = null;
        this.pendingTile = null;
    }

    /**
     * Fired after the finger has stayed down (roughly) in place for LONG_PRESS_MS -
     * this is what actually starts laying a belt path, so a plain move can still pan
     * the map without accidentally placing anything.
     */
    beginDrag() {
        this.holdTimer = null;
        if (!this.pendingTile) {
            return;
        }
        this.dragging = true;
        this.panning = false;
        this.dragStartTile = this.pendingTile;
        this.dragPath = [this.pendingTile];
        this.dragPreviewEntries = this.beltPathPlanner.beltTilesToEntries(this.dragPath);
        this.dragPreviewInvalid = false;
        this.pendingPos = null;
        this.pendingTile = null;
    }

    /**
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        if (button !== enumMouseButton.left) {
            return;
        }

        if (this.root.camera.getIsMapOverlayActive()) {
            // Building placement (blueprint-follows-finger, belt tap-
            // continuation) is allowed to keep working zoomed out into map
            // overview - see OverviewBuildingPolicy's doc. Everything else
            // (deletion, panning with nothing selected) stays blocked here
            // exactly like before.
            const metaBuilding = this.placerLogic.currentMetaBuilding.get();
            if (
                this.deleteModeActive ||
                this.selectModeActive ||
                this.pipetteModeActive ||
                !metaBuilding ||
                !this.overviewBuildingPolicy.isAllowed()
            ) {
                return;
            }
        }

        if (this.copiedBlueprintTile) {
            // Same finger-follow interaction as the MetaBuilding blueprint
            // mode below (draggingBlueprint/blueprintTile), just against the
            // copied Blueprint object instead - see onCopyClicked's doc.
            this.copiedBlueprintTile = this.root.camera.screenToWorld(pos).toTileSpace();
            return STOP_PROPAGATION;
        }

        if (this.selectModeActive) {
            // Drives the shared HUDMassSelector's own state directly (see the
            // massSelector getter's doc) - a plain tap (start === end at
            // release) selects whatever's under the finger, a drag rubber-
            // bands an area, both handled uniformly by its own onMouseUp.
            this.massSelector.currentSelectionStartWorld = this.root.camera.screenToWorld(pos.copy());
            this.massSelector.currentSelectionEnd = pos.copy();
            return STOP_PROPAGATION;
        }

        if (this.pipetteModeActive) {
            // Item 3: picks up whatever's at the tapped tile (or nothing) via
            // the same logic desktop's Q key uses - see pipetteAt's doc.
            const tile = this.root.camera.screenToWorld(pos).toTileSpace();
            this.placerLogic.pipetteAt(tile);
            this.exitPipetteMode();
            return STOP_PROPAGATION;
        }

        if (this.deleteModeActive) {
            const tile = this.root.camera.screenToWorld(pos).toTileSpace();
            const contents = this.root.map.getTileContent(tile, this.root.currentLayer);
            if (contents) {
                // tryDeleteBuilding can refuse (e.g. the hub) - endTransaction
                // already only pushes an undo entry if something was actually
                // recorded, so a refusal just leaves nothing to undo.
                this.root.actionHistory.beginTransaction();
                const deleted = this.root.logic.tryDeleteBuilding(contents);
                this.root.actionHistory.endTransaction();
                if (deleted) {
                    this.root.soundProxy.playUi(SOUNDS.destroyBuilding);
                }
            }
            return STOP_PROPAGATION;
        }

        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding) {
            // View mode: nothing placing/deleting/selecting - start the
            // long-press timer (see idleHoldPos's doc), but never stop
            // propagation here, so a real lever/waypoint tap or the
            // camera's own default pan both keep working exactly as before.
            this.idleHoldPos = pos.copy();
            this.idleHoldTimer = setTimeout(() => this.beginIdleLongPress(), LONG_PRESS_MS);
            return;
        }

        if (!this.isBeltSelected) {
            // Blueprint mode: every touch on the map - tap or drag - moves the
            // blueprint to/with the finger. Placement itself only happens via
            // the explicit confirm button, never on release.
            this.draggingBlueprint = true;
            this.blueprintTile = this.root.camera.screenToWorld(pos).toTileSpace();
            return STOP_PROPAGATION;
        }

        // Belt: unchanged from before - always intercept from here on,
        // HUDBuildingPlacerLogic must never place immediately on its own, we
        // decide in onMouseUp whether this was a tap or a completed drag.
        this.clearPendingHold();
        this.pendingPos = pos;
        this.pendingTile = this.root.camera.screenToWorld(pos).toTileSpace();
        this.lastPanPos = pos;
        this.panning = false;
        this.holdTimer = setTimeout(() => this.beginDrag(), LONG_PRESS_MS);
        return STOP_PROPAGATION;
    }

    /**
     * @param {Vector} pos
     */
    onMouseMove(pos) {
        if (this.idleHoldPos) {
            // Not stopping propagation - a real pan or another idle handler
            // (lever, waypoints) must keep receiving this move exactly as
            // before; only cancel our own hold once it's clearly a pan.
            if (pos.sub(this.idleHoldPos).length() > MAX_MOVE_DISTANCE_PX) {
                this.clearIdleHold();
            }
        }

        if (this.copiedBlueprintTile) {
            this.copiedBlueprintTile = this.root.camera.screenToWorld(pos).toTileSpace();
            return STOP_PROPAGATION;
        }

        if (this.selectModeActive && this.massSelector.currentSelectionStartWorld) {
            this.massSelector.currentSelectionEnd = pos.copy();
            return STOP_PROPAGATION;
        }

        if (this.draggingBlueprint) {
            this.blueprintTile = this.root.camera.screenToWorld(pos).toTileSpace();
            return STOP_PROPAGATION;
        }

        if (this.dragging) {
            const tile = this.root.camera.screenToWorld(pos).toTileSpace();
            const lastTile = this.dragPath[this.dragPath.length - 1];
            if (!tile.equals(lastTile)) {
                // Always recomputed from the press point to the current finger position -
                // not accumulated along wherever the finger physically travelled, which
                // just traces every wobble of a real finger instead of a clean path.
                // Item 9: live auto-tunnel planning while dragging, trying the
                // other L-corner too if the dominant-axis one can't be made
                // contiguous (findBeltPathToward) - if neither works, show
                // nothing here (draw() reads dragPreviewInvalid and tints
                // dragPath red instead) so release-time feedback
                // (flashInvalidBelt) isn't the only hint something's wrong.
                const { path, resolved } = this.findBeltPathToward(this.dragStartTile, tile, true, lastTile);
                this.dragPath = path;
                this.dragPreviewEntries = resolved || [];
                this.dragPreviewInvalid = !resolved;
            }
            return STOP_PROPAGATION;
        }

        // Already panning - keep going regardless of pendingPos (which gets cleared
        // the moment we transition into panning, see below).
        if (this.panning) {
            const camera = this.root.camera;
            const delta = this.lastPanPos.sub(pos).divideScalar(camera.zoomLevel);
            camera.center = camera.center.add(delta);
            camera.clampToBounds();
            this.lastPanPos = pos;
            return STOP_PROPAGATION;
        }

        if (this.pendingPos) {
            if (pos.sub(this.pendingPos).length() > MAX_MOVE_DISTANCE_PX) {
                // Moved too far before the hold fired - this is a pan, not a
                // placement. Belt-only at this point (non-belt buildings never
                // reach pendingPos any more, see onMouseDown's early return).
                this.clearPendingHold();
                this.panning = true;
                this.lastPanPos = pos;
            }
            return STOP_PROPAGATION;
        }
    }

    onMouseUp() {
        if (this.idleHoldPos) {
            // Released before the hold fired - a plain idle tap, nothing to
            // do (matches the pre-existing behavior: idle taps have never
            // triggered anything of mobile_controls's own on release).
            this.clearIdleHold();
        }

        if (this.selectModeActive && this.massSelector.currentSelectionStartWorld) {
            this.massSelector.onMouseUp();
            return;
        }

        if (this.draggingBlueprint) {
            this.draggingBlueprint = false;
            return;
        }

        if (this.dragging) {
            this.dragging = false;
            if (this.dragPath.length <= 1) {
                // Held without ever moving - treat like a plain tap.
                this.placeBeltTapAt(this.dragPath[0] || this.dragStartTile);
            } else if (this.dragPreviewInvalid) {
                // Item 9: crosses an obstacle no unlocked tunnel can bridge -
                // flash it red instead of placing a gapped/broken belt.
                this.flashInvalidBelt(this.dragPath);
            } else {
                const releaseTile = this.dragPath[this.dragPath.length - 1];
                const releaseWasOccupied = !!this.root.map.getLayerContentXY(
                    releaseTile.x,
                    releaseTile.y,
                    "regular"
                );
                this.placePath(this.dragPreviewEntries, releaseWasOccupied);
            }
            this.dragPath = [];
            this.dragPreviewEntries = [];
            this.dragPreviewInvalid = false;
            return;
        }

        if (this.pendingPos && !this.panning) {
            // Released without moving and without the hold firing - plain tap.
            this.placeBeltTapAt(this.pendingTile);
        }
        this.clearPendingHold();
        this.panning = false;
    }

    /**
     * Draws a semi-transparent copy of the real building sprite at the given
     * tile/rotation - reuses the same fakeEntity + blueprint sprite mechanism
     * HUDBuildingPlacer uses for its (desktop, mouse-hover-driven) ghost
     * preview. A tunnel entry (see findBeltPath) uses its own fake entity
     * and the tunnel building/variant instead of belt's - its
     * rotationVariant means sender/receiver, not straight/curve, so drawing
     * it as a belt would show the wrong sprite entirely (found live on a
     * real device: tunnel spans previewed as random-looking belt curves).
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     * @param {PathEntry} entry
     */
    drawPreviewEntry(parameters, entry) {
        const metaBuilding = entry.isTunnel
            ? this.beltPathPlanner.tunnelMetaBuilding
            : this.placerLogic.currentMetaBuilding.get();
        const fakeEntity = entry.isTunnel ? this.tunnelFakeEntity : this.placerLogic.fakeEntity;
        const variant = entry.isTunnel ? entry.tunnelVariant : this.placerLogic.currentVariant.get();
        const staticComp = fakeEntity.components.StaticMapEntity;

        // entry.rotation/rotationVariant (computed in beltTilesToEntries, or
        // explicitly by findBeltPath for a tunnel entry) already accounts
        // for curves/sender-vs-receiver. Querying
        // computeOptimalDirectionAndRotationVariantAtTile here instead would look at
        // *real* map neighbours, none of which exist yet since nothing is built.
        staticComp.origin = entry.tile;
        staticComp.rotation = entry.rotation;
        metaBuilding.updateVariants(fakeEntity, entry.rotationVariant, variant);

        staticComp.drawSpriteOnBoundsClipped(
            parameters,
            metaBuilding.getBlueprintSprite(entry.rotationVariant, variant)
        );
    }

    /**
     * Draws the blueprint-mode ghost preview at its current tile, tinted by
     * whether it could actually be placed there right now - mirrors
     * HUDBuildingPlacer.drawRegularPlacement's desktop ghost (same
     * computeOptimalDirectionAndRotationVariantAtTile call, so the preview's
     * rotation matches what confirming will actually place), including the
     * green/red accepted-slot arrows (drawMatchingAcceptorsAndEjectors,
     * shared with desktop via HUDBuildingPlacerLogic) but without the
     * bounding-box outline, which isn't needed at this icon-sized scale.
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    drawBlueprintGhost(parameters) {
        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding) {
            return;
        }
        const variant = this.placerLogic.currentVariant.get();
        const { rotation, rotationVariant } = metaBuilding.computeOptimalDirectionAndRotationVariantAtTile({
            root: this.root,
            tile: this.blueprintTile,
            rotation: this.placerLogic.currentBaseRotation,
            variant,
            layer: metaBuilding.getLayer(),
        });

        this.placerLogic.fakeEntity.layer = metaBuilding.getLayer();
        const staticComp = this.placerLogic.fakeEntity.components.StaticMapEntity;
        staticComp.origin = this.blueprintTile;
        staticComp.rotation = rotation;
        metaBuilding.updateVariants(this.placerLogic.fakeEntity, rotationVariant, variant);
        staticComp.code = getCodeFromBuildingData(metaBuilding, variant, rotationVariant);

        const canBuild = this.root.logic.checkCanPlaceEntity(this.placerLogic.fakeEntity, {});
        parameters.context.globalAlpha = canBuild ? 0.85 : 0.35;
        staticComp.drawSpriteOnBoundsClipped(
            parameters,
            metaBuilding.getBlueprintSprite(rotationVariant, variant)
        );
        parameters.context.globalAlpha = 1;

        if (canBuild) {
            this.placerLogic.drawMatchingAcceptorsAndEjectors(parameters);
        }
    }

    /**
     * @see BaseHUDPart.draw
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    draw(parameters) {
        if (this.blueprintTile && !this.isBeltSelected) {
            this.drawBlueprintGhost(parameters);
        }

        if (this.copiedBlueprintTile) {
            const blueprint = this.blueprintPlacer.currentBlueprint.get();
            if (blueprint) {
                blueprint.draw(parameters, this.copiedBlueprintTile);
            }
        }

        // Item 9: a completed-but-rejected belt (a tap or a released drag
        // findBeltPath couldn't make contiguous) blinks red for a moment
        // instead of anything being placed.
        if (this.invalidBeltFlash) {
            this.drawInvalidBeltFlash(parameters);
        }

        if (this.dragging && this.dragPreviewInvalid) {
            // Item 9: live feedback while still dragging through an
            // unbridgeable obstacle - steady, not blinking (the blink is
            // reserved for the release-time flash above).
            this.drawRedTiles(parameters, this.dragPath, 0.4);
            return;
        }

        if (this.dragPreviewEntries.length === 0) {
            return;
        }
        if (!this.placerLogic.currentMetaBuilding.get()) {
            return;
        }

        parameters.context.globalAlpha = 0.6;
        for (let i = 0; i < this.dragPreviewEntries.length; ++i) {
            this.drawPreviewEntry(parameters, this.dragPreviewEntries[i]);
        }
        parameters.context.globalAlpha = 1;
    }

    /**
     * Item 9 helper: flat red tint over a list of tiles - shared by the live
     * invalid-drag preview and the post-release blink flash below.
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     * @param {Array<Vector>} tiles
     * @param {number} alpha
     */
    drawRedTiles(parameters, tiles, alpha) {
        parameters.context.fillStyle = `rgba(230, 50, 50, ${alpha})`;
        for (let i = 0; i < tiles.length; ++i) {
            const tile = tiles[i];
            parameters.context.fillRect(
                tile.x * globalConfig.tileSize,
                tile.y * globalConfig.tileSize,
                globalConfig.tileSize,
                globalConfig.tileSize
            );
        }
    }

    /**
     * Item 9: a couple of quick alpha pulses over invalidBeltFlash.path,
     * closer to an actual "blink" than one flat flash - see flashInvalidBelt.
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    drawInvalidBeltFlash(parameters) {
        const duration = 0.6;
        const elapsed = this.root.time.realtimeNow() - this.invalidBeltFlash.startedAt;
        if (elapsed > duration) {
            return;
        }
        const alpha = 0.3 + 0.35 * Math.abs(Math.sin((elapsed / duration) * Math.PI * 3));
        this.drawRedTiles(parameters, this.invalidBeltFlash.path, alpha);
    }

    /**
     * The buildings/wires toolbar spans the full screen width now (see
     * buildings_toolbar.scss), so this panel has to sit above whichever toolbar
     * page is currently on top rather than beside it - and that height changes
     * as more toolbar pages unlock over the course of the game, so it's measured
     * instead of assumed.
     */
    updateToolbarOffset() {
        // getBoundingClientRect() forces a layout reflow - throttled the same way
        // DynamicDomAttach's trackHover does, since this doesn't need to be
        // exactly up to the frame (only changes when a toolbar page unlocks).
        const now = this.root.time.realtimeNow();
        if (this.lastToolbarOffsetCheck && now - this.lastToolbarOffsetCheck < 0.25) {
            return;
        }
        this.lastToolbarOffsetCheck = now;

        const toolbar = document.querySelector(".ingame_buildingsToolbar.visible");
        const height = toolbar ? toolbar.getBoundingClientRect().height : 0;
        // Both the mobile controls and the interactive tutorial are siblings
        // in the HUD. Set the value on html so each can clear the toolbar.
        document.documentElement.style.setProperty("--toolbar-height", height + "px");
    }

    update() {
        this.updateToolbarOffset();

        this.undoButton.classList.toggle("disabled", !this.root.actionHistory.canUndo);
        // The belt panel's own undo is scoped to *this belt* specifically,
        // not the global history - dims once there's nothing left of the
        // current belt to undo (no tap made yet, or already rolled all the
        // way back to its start), even if the global stack still has older,
        // unrelated history it could otherwise undo into.
        this.beltUndoButton.classList.toggle("disabled", !this.lastBeltTile);
        this.redoButton.classList.toggle("disabled", !this.root.actionHistory.canRedo);

        // Item 1: only shown once wires are unlocked - same gate
        // HUDWiresOverlay.switchLayers itself checks before actually
        // switching.
        const layersAvailable =
            this.root.gameMode.getSupportsWires() &&
            (this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_wires_painter_and_levers) ||
                (G_IS_DEV && globalConfig.debug.allBuildingsUnlocked));
        this.layersButton.hidden = !layersAvailable;
        this.layersButton.classList.toggle("active", this.root.currentLayer === "wires");

        if (this.invalidBeltFlash && this.root.time.realtimeNow() - this.invalidBeltFlash.startedAt > 0.6) {
            this.invalidBeltFlash = null;
        }

        // If the blueprint got aborted through some other path (e.g. desktop's
        // own Escape keybinding, still registered regardless of platform),
        // fall back out of copied-blueprint mode instead of leaving its row
        // stuck up with nothing left to act on.
        if (this.copiedBlueprintTile && !this.blueprintPlacer.currentBlueprint.get()) {
            if (this.movedBuildingCut && this.root.actionHistory.canUndo) {
                this.root.actionHistory.undo();
            }
            this.copiedBlueprintTile = null;
            this.movedBuildingCut = false;
        }

        this.element.classList.toggle("placing", !!this.placerLogic.currentMetaBuilding.get());
        this.element.classList.toggle("selecting", this.selectModeActive);
        this.element.classList.toggle("copyingBlueprint", !!this.copiedBlueprintTile);
    }
}
