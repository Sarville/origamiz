import { MAX_MOVE_DISTANCE_PX } from "../../../core/click_detector";
import { globalConfig } from "../../../core/config";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { STOP_PROPAGATION } from "../../../core/signal";
import { makeDiv } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { SOUNDS } from "../../../platform/sound";
import { getCodeFromBuildingData } from "../../building_codes";
import { MetaUndergroundBeltBuilding, enumUndergroundBeltVariants } from "../../buildings/underground_belt";
import { enumMouseButton } from "../../camera";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { Entity } from "../../entity";
import { defaultBuildingVariant } from "../../meta_building";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { BaseHUDPart } from "../base_hud_part";

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
 * part of the chain the path itself starts or ends on, see resolveBeltPath's
 * exemptPaths - is auto-bridged with a tunnel pair instead of just leaving a
 * gap there, if an unlocked tunnel tier's range covers it - see
 * resolveBeltPath. A belt the path starts *or* ends on (dragging/tapping
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

        this.undoButton = document.createElement("button");
        this.undoButton.classList.add("undo", "disabled");
        this.element.appendChild(this.undoButton);
        this.trackClicks(this.undoButton, this.onUndoClicked);

        this.redoButton = document.createElement("button");
        this.redoButton.classList.add("redo", "disabled");
        this.element.appendChild(this.redoButton);
        this.trackClicks(this.redoButton, this.onRedoClicked);

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

        this.deleteModeActive = false;

        // Persists across building selections, not per-building - a player
        // preference for how placing works, not a building property.
        this.multiplaceMode = false;

        this.dragging = false;
        this.dragStartTile = null;
        /** @type {Array<Vector>} */
        this.dragPath = [];
        /** @type {Array<PathEntry>} */
        this.dragPreviewEntries = [];
        // Set alongside dragPreviewEntries whenever resolveBeltPath (item 9's
        // auto-tunnel planning) can't make the currently-dragged path
        // contiguous - dragPreviewEntries is left empty and draw() shows a
        // red tint over dragPath instead of ghost belts.
        this.dragPreviewInvalid = false;

        // Item 9: a brief red flash over a just-rejected belt path (a tap or
        // a completed drag that resolveBeltPath couldn't make contiguous),
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
                this.dragging = false;
                this.dragPath = [];
                this.dragPreviewEntries = [];
                this.dragPreviewInvalid = false;
                this.panning = false;
                this.draggingBlueprint = false;
            }
        };
        this.root.canvas.addEventListener("touchstart", this.cancelGestureOnSecondTouch);
    }

    onPlacementBuildingChanged(metaBuilding) {
        if (metaBuilding) {
            this.deleteModeActive = false;
            this.deleteButton.classList.remove("active");
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

    get tunnelMetaBuilding() {
        return gMetaBuildingRegistry.findByClass(MetaUndergroundBeltBuilding);
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
            const building = this.tunnelMetaBuilding;
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
            this.placerLogic.currentMetaBuilding.set(null);
        }
    }

    onCancelClicked() {
        this.placerLogic.currentMetaBuilding.set(null);
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
     * All tiles on a straight run between two tiles that already share an axis (same
     * x or same y) - a single leg of an L-shaped corner path.
     * @param {Vector} from
     * @param {Vector} to
     * @returns {Array<Vector>}
     */
    axisSegment(from, to) {
        const path = [];
        if (from.x === to.x) {
            const step = to.y >= from.y ? 1 : -1;
            for (let y = from.y; y !== to.y + step; y += step) {
                path.push(new Vector(from.x, y));
            }
        } else {
            const step = to.x >= from.x ? 1 : -1;
            for (let x = from.x; x !== to.x + step; x += step) {
                path.push(new Vector(x, from.y));
            }
        }
        return path;
    }

    /**
     * Connects two arbitrary tiles with an L-shaped path: straight along whichever
     * axis has the larger delta first, then one turn, then straight the rest of the
     * way - same shape the desktop belt planner (Shift+drag) uses, rather than a
     * Bresenham staircase (which isn't a buildable belt shape - every tile would need
     * to be a corner piece).
     * @param {Vector} from
     * @param {Vector} to
     * @returns {Array<Vector>}
     */
    computeCornerPath(from, to, horizontalFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
        const corner = horizontalFirst ? new Vector(to.x, from.y) : new Vector(from.x, to.y);
        const firstLeg = this.axisSegment(from, corner);
        const secondLeg = this.axisSegment(corner, to);
        return firstLeg.concat(secondLeg.slice(1));
    }

    /**
     * Resolves a belt path from `from` to `to`, trying the dominant-axis
     * corner (computeCornerPath's default) first and falling back to the
     * other corner if that one can't be bridged - a single fixed corner can
     * run straight back over a belt that's already there (particularly
     * against its own direction, which reads as a crossing rather than a
     * harmless retrace) even when the other way round would have reached
     * the same destination with nothing in the way. Found live: tapping 2
     * tiles above the *start* of an L-shaped belt (far from lastBeltTile,
     * at the other end) picked the horizontal-first corner - which runs
     * back along the entire belt just built - and rejected as unbridgeable,
     * while tapping further up (past dx/dy flipping which axis is
     * "dominant") worked fine as the same request.
     * @param {Vector} from
     * @param {Vector} to
     * @param {boolean} allowReshape See resolveBeltPath - true for a drag,
     * false for tap-continuation.
     * @returns {{ path: Array<Vector>, resolved: Array<PathEntry>|null }} `path` is
     * always the primary corner's tiles (used for the red-flash preview on
     * total failure), `resolved` is whichever corner actually worked, if any.
     */
    resolveBeltPathToward(from, to, allowReshape) {
        const primaryPath = this.computeCornerPath(from, to);
        const primaryResolved = this.resolveBeltPath(primaryPath, allowReshape);
        if (primaryResolved) {
            return { path: primaryPath, resolved: primaryResolved };
        }
        const horizontalFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
        const altPath = this.computeCornerPath(from, to, !horizontalFirst);
        const altResolved = this.resolveBeltPath(altPath, allowReshape);
        if (altResolved) {
            return { path: altPath, resolved: altResolved };
        }
        return { path: primaryPath, resolved: null };
    }

    /**
     * Compass direction (0/90/180/270) of travel from one tile to an adjacent one.
     * @param {Vector} from
     * @param {Vector} to
     */
    directionBetween(from, to) {
        const delta = to.sub(from);
        return (Math.round(Math.degrees(delta.angle()) / 90) * 90 + 360) % 360;
    }

    /**
     * Turns an ordered belt-tile path into entries with a rotation and curve
     * rotationVariant derived from the tile *sequence* - which way to point to reach
     * the next tile, and whether the incoming tile arrives from the side rather than
     * straight behind - rather than from raw per-frame touch deltas (a finger never
     * moves in a perfectly straight line) or from real map neighbours (nothing is
     * actually built yet, so MetaBeltBuilding's own
     * computeOptimalDirectionAndRotationVariantAtTile can't see a curve coming).
     * @param {Array<Vector>} path
     * @returns {Array<PathEntry>}
     */
    beltTilesToEntries(path) {
        if (path.length === 0) {
            return [];
        }
        const entries = [];
        for (let i = 0; i < path.length; ++i) {
            let outgoing;
            if (i < path.length - 1) {
                outgoing = this.directionBetween(path[i], path[i + 1]);
            } else if (i > 0) {
                // Last tile in a multi-tile path: keep pointing the way it was heading.
                outgoing = this.directionBetween(path[i - 1], path[i]);
            } else {
                entries.push({
                    tile: path[i],
                    rotation: this.placerLogic.currentBaseRotation,
                    rotationVariant: 0,
                });
                continue;
            }
            const incoming = i > 0 ? this.directionBetween(path[i - 1], path[i]) : undefined;
            entries.push(this.curvedEntry(path[i], outgoing, incoming));
        }
        return entries;
    }

    /**
     * Rotation + curve rotationVariant for one belt tile, given the
     * direction it heads onward (outgoing) and the direction it was reached
     * from (incoming - omit for a path's very first tile, which has none).
     * Shared by beltTilesToEntries (an isolated, no-tunnel path) and
     * resolveBeltPath's flushRun (a plain run flanked by tunnel entries) -
     * the latter needs outgoing/incoming from the *whole* path (resolveBeltPath's
     * own `directions`), not ones recomputed from an out-of-context slice, or a
     * run that's only one tile long (sandwiched directly between two tunnels)
     * has no neighbours left in the slice to compute a direction from at all
     * and used to silently fall back to whatever currentBaseRotation happened
     * to be left over from an unrelated previous placement - reproduced live:
     * tapping straight across two belt crossings in one go left a turned
     * piece between the two tunnel pairs instead of a straight one.
     * @param {Vector} tile
     * @param {number} outgoing
     * @param {number=} incoming
     */
    curvedEntry(tile, outgoing, incoming) {
        let rotation = outgoing;
        let rotationVariant = 0;
        if (incoming !== undefined) {
            if (incoming === (outgoing + 270) % 360) {
                // Fed from the right - curves to meet it, same as
                // MetaBeltBuilding.computeOptimalDirectionAndRotationVariantAtTile
                // does for a real ejector feeding in from that side.
                rotation = (outgoing + 270) % 360;
                rotationVariant = 2;
            } else if (incoming === (outgoing + 90) % 360) {
                rotation = (outgoing + 90) % 360;
                rotationVariant = 1;
            }
        }
        return { tile, rotation, rotationVariant };
    }

    /**
     * The Belt component at the given tile, or null - just the
     * getLayerContentXY + null-check dance isTileBlockedForBelt and
     * resolveBeltPath both need, shared to avoid repeating it.
     * @param {Vector} tile
     */
    beltAt(tile) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        return (contents && contents.components.Belt) || null;
    }

    /**
     * Item 9: whether a plain belt can't go on this tile without either
     * failing outright or silently severing something unrelated.
     *
     * A real, non-replaceable building always blocks
     * (MetaBuilding.getIsReplaceable) - still needs a tunnel to get past.
     * A belt already on the tile is never blocked - freely overwritten and
     * rebuilt facing the new path's own direction, the same way a single
     * tap already overwrites whatever belt was underneath it - when it's
     * either of the path's own two ends (the tile the finger pressed down
     * on, or the tile it's currently released/tapped at) or part of that
     * same connected chain (`anchorTiles`/`exemptPaths`, computed once in
     * resolveBeltPath from path[0]/path[last] - this is what lets a drag
     * starting *or* ending on an existing belt reshape/merge/reverse it, and
     * what lets tapping one belt's tile to another's connect the two). A
     * *different* belt encountered strictly in between - not the one being
     * dragged from, not the one being dragged to - still counts as a
     * foreign crossing needing a tunnel, unless it already happens to face
     * the exact direction this path needs there anyway (redundant,
     * harmless to overwrite).
     * @param {Vector} tile
     * @param {number} incomingDirection Compass degrees (0/90/180/270) our
     * own path travels through this tile.
     * @param {Array<import("../../belt_path").BeltPath>} exemptPaths
     * @param {Array<Vector>} anchorTiles
     */
    isTileBlockedForBelt(tile, incomingDirection, exemptPaths, anchorTiles) {
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        if (!contents) {
            return false;
        }
        const staticComp = contents.components.StaticMapEntity;
        if (
            !staticComp
                .getMetaBuilding()
                .getIsReplaceable(staticComp.getVariant(), staticComp.getRotationVariant())
        ) {
            return true;
        }
        if (!contents.components.Belt) {
            return false;
        }
        if (anchorTiles.some(anchor => anchor && anchor.equals(tile))) {
            return false;
        }
        const assignedPath = contents.components.Belt.assignedPath;
        if (assignedPath && exemptPaths.includes(assignedPath)) {
            return false;
        }
        return staticComp.rotation !== incomingDirection;
    }

    /**
     * Item 9: the smallest unlocked tunnel tier whose range covers the given
     * tile distance, or null if none does (including tunnels not being
     * unlocked at all yet) - mirrors
     * MetaUndergroundBeltBuilding.computeOptimalDirectionAndRotationVariantAtTile's
     * own range/tier rules rather than duplicating them loosely.
     * @param {number} distance
     * @returns {string|null}
     */
    pickTunnelTier(distance) {
        if (!this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_tunnel)) {
            return null;
        }
        if (distance <= globalConfig.undergroundBeltMaxTilesByTier[0]) {
            return defaultBuildingVariant;
        }
        if (
            this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_underground_belt_tier_2) &&
            distance <= globalConfig.undergroundBeltMaxTilesByTier[1]
        ) {
            return enumUndergroundBeltVariants.tier2;
        }
        return null;
    }

    /**
     * Item 9 - auto-tunnel planning: given a raw belt tile path, checks
     * whether it's blocked by any real (non-belt-replaceable) building, or
     * by a belt that isn't part of the chain the path itself starts or ends
     * on (see isTileBlockedForBelt/exemptPaths - the two ends' own belts,
     * dragged/tapped from one to the other, always just get reshaped, never
     * tunnelled), and, if every blocked run can be bridged with a tunnel
     * pair, returns the full placement plan with tunnel entries substituted
     * in; otherwise returns null, meaning this path can't become a
     * contiguous belt at all (too long a gap for any unlocked tier, tunnels
     * not unlocked, or the
     * blocked run doesn't lie on a single straight line - a tunnel can't
     * turn a corner underground).
     *
     * Splits the path into alternating plain-belt runs and tunnel bridges
     * rather than patching beltTilesToEntries' output in place - a tunnel
     * breaks curve continuity anyway (the belt travels straight underground,
     * so there's nothing to curve-detect across it), so each plain run's
     * rotation/curves are computed independently and the two are
     * concatenated back together in order.
     * @param {Array<Vector>} path
     * @param {boolean} allowReshape Drag (a held finger moving across the
     * map) may reshape/merge whichever belts the path starts and ends on -
     * see the anchorTiles/exemptPaths doc just below. Tap-continuation
     * (placeBeltTapAt, item 8) never may: each tap only ever *extends* the
     * belt from wherever it last ended, so anything already built beyond
     * that single tile is treated as a genuine obstacle like any other -
     * bridged with a tunnel if geometrically possible, otherwise rejected -
     * rather than silently rewritten. Found live: tapping 2 tiles past the
     * *start* of an already-built belt, continuing from its far end,
     * reshaped/reversed the whole thing in one tap instead of leaving it
     * alone.
     * @returns {Array<PathEntry>|null}
     */
    resolveBeltPath(path, allowReshape) {
        if (path.length < 2) {
            // Nothing to bridge - if the lone tile is itself blocked,
            // placement just fails normally, same as before this feature.
            return this.beltTilesToEntries(path);
        }

        // The direction our own path travels through each tile - used by
        // curvedEntry below and by the straight-line check a bit further
        // down (a tunnel bridging a real building can't turn a corner). Same
        // convention beltTilesToEntries' "outgoing" uses: the tile's own
        // onward direction, or its incoming one for the last tile.
        const directions = path.map((tile, idx) =>
            idx < path.length - 1
                ? this.directionBetween(path[idx], path[idx + 1])
                : this.directionBetween(path[idx - 1], path[idx])
        );

        // Both ends of the path - the tile the finger pressed down on, and
        // wherever it's currently released/tapped at - are exempt from
        // isTileBlockedForBelt's crossing check, along with their whole
        // connected chain (BeltPath, tracked as Belt.assignedPath): pressing
        // on one belt and dragging to another should merge/reshape them,
        // not tunnel between them. A *different*, unrelated belt crossed
        // strictly in between still counts as a foreign crossing. Only for
        // a drag, though (allowReshape) - a tap-continuation exempts tile 0
        // alone (still needed so the very tile it continues from isn't a
        // "crossing" of itself), never its wider chain or the end tile, so
        // it only ever extends, never reshapes.
        const endTile = path[path.length - 1];
        const startBelt = this.beltAt(path[0]);
        const endBelt = this.beltAt(endTile);
        const anchorTiles = allowReshape ? [path[0], endTile] : [path[0]];
        const exemptPaths = allowReshape
            ? [startBelt && startBelt.assignedPath, endBelt && endBelt.assignedPath].filter(Boolean)
            : [];

        // Both anchors need the direction flow already had there *before*
        // this call overwrites them, so the junction curves to continue it
        // instead of meeting it with a flat right-angle joint (found live,
        // twice: a chained continuation tap not curving into its own
        // previous corner, and connecting into a *different*, previously
        // untouched belt not curving into whichever way that one already
        // flowed). For the end anchor that's simply its current rotation
        // (the direction it keeps flowing in past this point). For the
        // start anchor it's almost the same, with one refinement: if this
        // is a *true* continuation (path[0] is lastBeltTile, which we
        // placed ourselves last call) lastBeltIncomingDirection has the
        // tile's *real* incoming edge on file already - its own current
        // rotation is only that same value for a straight tile, but wrong
        // for a curve (rotation there is its outgoing, not incoming). A
        // fresh grab of some other, already-standing belt has no such
        // history to consult, so its current rotation is the best available
        // stand-in - right for the (overwhelmingly common) straight case,
        // an approximation only where that tile itself happens to be a
        // curve.
        const startIncomingDirection = startBelt
            ? !!this.lastBeltTile && path[0].equals(this.lastBeltTile)
                ? this.lastBeltIncomingDirection
                : this.root.map.getLayerContentXY(path[0].x, path[0].y, "regular").components.StaticMapEntity
                      .rotation
            : undefined;
        const endOutgoingDirection = endBelt
            ? this.root.map.getLayerContentXY(endTile.x, endTile.y, "regular").components.StaticMapEntity
                  .rotation
            : undefined;

        const resolvedEntries = [];
        let runStart = 0;
        // Built from the global directions[] (computed above from the *whole*
        // path) rather than delegating to beltTilesToEntries on a bare slice -
        // a run flanked by tunnel entries on both sides still needs its
        // real incoming/outgoing direction, and a slice loses that entirely
        // for a run that's only one tile long (no neighbours left inside the
        // slice to compute a direction from at all - see curvedEntry's doc).
        const flushRun = endExclusive => {
            for (let k = runStart; k < endExclusive; ++k) {
                const incoming = k > 0 ? directions[k - 1] : startIncomingDirection;
                const outgoing =
                    k === path.length - 1 && endOutgoingDirection !== undefined
                        ? endOutgoingDirection
                        : directions[k];
                resolvedEntries.push(this.curvedEntry(path[k], outgoing, incoming));
            }
        };

        let i = 0;
        while (i < path.length) {
            if (!this.isTileBlockedForBelt(path[i], directions[i], exemptPaths, anchorTiles)) {
                i++;
                continue;
            }

            // Found the start of a blocked run - find where it ends.
            let j = i;
            while (
                j + 1 < path.length &&
                this.isTileBlockedForBelt(path[j + 1], directions[j + 1], exemptPaths, anchorTiles)
            ) {
                j++;
            }

            // Needs a clear tile on both sides to flank with a tunnel pair.
            if (i === 0 || j === path.length - 1) {
                return null;
            }

            // Must lie on a single straight line - a tunnel can't turn a
            // corner, so a blocked run straddling the path's own corner (or
            // one that isn't axis-aligned throughout for any other reason)
            // can't be bridged.
            const direction = this.directionBetween(path[i - 1], path[i]);
            for (let k = i - 1; k <= j; ++k) {
                if (this.directionBetween(path[k], path[k + 1]) !== direction) {
                    return null;
                }
            }

            const entrance = path[i - 1];
            const exit = path[j + 1];

            // The tile right before this obstacle may already be claimed as
            // the *previous* tunnel's exit (two separate obstacles with only
            // one clear tile between them) - no room for it to also be this
            // one's entrance.
            const previous = resolvedEntries[resolvedEntries.length - 1];
            if (previous && previous.isTunnel && previous.tile.equals(entrance)) {
                return null;
            }

            const distance = Math.round(exit.sub(entrance).length());
            const tier = this.pickTunnelTier(distance);
            if (tier === null) {
                return null;
            }

            // Flush the plain run up to (not including) the entrance tile -
            // it's about to be pushed as a tunnel entry instead.
            flushRun(i - 1);
            resolvedEntries.push({
                tile: entrance,
                rotation: direction,
                rotationVariant: 0, // sender
                isTunnel: true,
                tunnelVariant: tier,
            });
            resolvedEntries.push({
                tile: exit,
                rotation: direction,
                rotationVariant: 1, // receiver
                isTunnel: true,
                tunnelVariant: tier,
            });

            runStart = j + 2; // next plain run starts right after the exit tile
            i = runStart;
        }
        flushRun(path.length);
        return resolvedEntries;
    }

    /**
     * Item 9: momentarily tints the given (unplaceable) path red instead of
     * placing anything - feedback for "a continuous belt isn't possible
     * here" (the gap is too long for any unlocked tunnel tier, tunnels
     * aren't unlocked, or the blocked run isn't a straight enough line for a
     * tunnel to bridge at all). Cleared automatically in update().
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
        this.root.actionHistory.endTransaction(
            this.isBeltSelected
                ? { beltTileBefore, beltTileAfter: tile, beltIncomingBefore, beltIncomingAfter: undefined }
                : null
        );
        if (placed) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
            // Most buildings deselect themselves after one placement (unless they
            // "stay in placement mode", like belts always do) - multiplace mode
            // means "keep going", so reselect if that just happened.
            if (this.multiplaceMode && !this.placerLogic.currentMetaBuilding.get()) {
                this.placerLogic.currentMetaBuilding.set(metaBuilding);
            }
            if (this.isBeltSelected) {
                this.lastBeltTile = tile;
                // placeSingle only ever starts a fresh, unconnected belt (see
                // placeBeltTapAt) - there's no real predecessor tile to have
                // an incoming direction from.
                this.lastBeltIncomingDirection = undefined;
            }
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
            const { path, resolved } = this.resolveBeltPathToward(this.lastBeltTile, tile, false);
            if (!resolved) {
                // Item 9: crosses an obstacle no unlocked tunnel can bridge -
                // flash it red instead of placing a gapped/broken belt.
                this.flashInvalidBelt(path);
                return;
            }
            this.placePath(resolved);
        } else {
            this.placeSingle(tile, this.placerLogic.currentBaseRotation);
        }
    }

    /**
     * Places every entry of a completed belt drag (or tap-continuation,
     * see placeBeltTapAt) immediately.
     * @param {Array<PathEntry>} entries
     */
    placePath(entries) {
        if (entries.length === 0) {
            return;
        }
        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding) {
            return;
        }

        const beltTileBefore = this.lastBeltTile;
        const beltIncomingBefore = this.lastBeltIncomingDirection;
        let anythingPlaced = false;

        // One transaction for the whole path (and any side effects it
        // triggers), not one per tile - so a whole dragged/tapped-out belt
        // undoes in a single step. See ActionHistory's class doc. Belt
        // continuity (lastBeltTile) rides along as transaction meta, same as
        // placeSingle - placePath is belt-only, so no isBeltSelected guard
        // needed here.
        this.root.actionHistory.beginTransaction();
        this.root.logic.performBulkOperation(() => {
            // systems/belt.js's updateSurroundingBeltPlacement listens for
            // entityAdded and re-derives each *neighbour's* rotation from
            // real map state (computeOptimalDirectionAndRotationVariantAtTile
            // again) right after every single placement - normally exactly
            // what makes an existing belt curve to meet a new one, but fatal
            // here: placing this path's *second* tile immediately re-examines
            // and silently reverts the first tile's rotation back to match
            // its still-unchanged old neighbours, since at that point in the
            // loop the rest of the new path doesn't exist yet either. It
            // already no-ops entirely under performImmutableOperation (see
            // its own root.immutableOperationRunning check) - every tile of
            // this path already has its final, whole-path-aware rotation
            // from curvedEntry, so there's nothing for it to correct here.
            this.root.logic.performImmutableOperation(() => {
                for (let i = 0; i < entries.length; ++i) {
                    // Belts always "stay in placement mode" so this shouldn't normally be
                    // needed, but keep it as a safety net against a null-deref.
                    if (!this.placerLogic.currentMetaBuilding.get()) {
                        this.placerLogic.currentMetaBuilding.set(metaBuilding);
                    }
                    const entry = entries[i];
                    // Bypasses tryPlaceCurrentBuildingAt's own
                    // rotation/rotationVariant auto-detection
                    // (computeOptimalDirectionAndRotationVariantAtTile) and calls
                    // GameLogic.tryPlaceBuilding directly - same reasoning as
                    // the immutable-operation wrapper above, one level down:
                    // we've already worked out this entry's rotation/curve from
                    // the *whole* path (curvedEntry, or explicitly for a
                    // tunnel), and the single-tile auto-detection re-deriving
                    // one from real map neighbours instead can override it.
                    if (
                        this.root.logic.tryPlaceBuilding({
                            origin: entry.tile,
                            rotation: entry.rotation,
                            originalRotation: entry.rotation,
                            rotationVariant: entry.rotationVariant,
                            variant: entry.isTunnel ? entry.tunnelVariant : this.placerLogic.currentVariant.get(),
                            building: entry.isTunnel ? this.tunnelMetaBuilding : metaBuilding,
                        })
                    ) {
                        anythingPlaced = true;
                    }
                }
            });
        });
        // The direction the belt actually flowed into its own final tile -
        // see lastBeltIncomingDirection's doc. entries[len-2] may be a
        // tunnel sender several tiles away rather than a direct neighbour,
        // but directionBetween still resolves to the right compass
        // direction for any straight axis-aligned span, tunnel gap
        // included.
        const beltIncomingAfter =
            entries.length >= 2
                ? this.directionBetween(
                      entries[entries.length - 2].tile,
                      entries[entries.length - 1].tile
                  )
                : undefined;
        this.root.actionHistory.endTransaction({
            beltTileBefore,
            beltTileAfter: entries[entries.length - 1].tile,
            beltIncomingBefore,
            beltIncomingAfter,
        });

        if (anythingPlaced) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
            this.lastBeltTile = entries[entries.length - 1].tile;
            this.lastBeltIncomingDirection = beltIncomingAfter;
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
        this.dragPreviewEntries = this.beltTilesToEntries(this.dragPath);
        this.dragPreviewInvalid = false;
        this.pendingPos = null;
        this.pendingTile = null;
    }

    /**
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        if (button !== enumMouseButton.left || this.root.camera.getIsMapOverlayActive()) {
            return;
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
                // contiguous (resolveBeltPathToward) - if neither works, show
                // nothing here (draw() reads dragPreviewInvalid and tints
                // dragPath red instead) so release-time feedback
                // (flashInvalidBelt) isn't the only hint something's wrong.
                const { path, resolved } = this.resolveBeltPathToward(this.dragStartTile, tile, true);
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
                this.placePath(this.dragPreviewEntries);
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
     * preview. A tunnel entry (see resolveBeltPath) uses its own fake entity
     * and the tunnel building/variant instead of belt's - its
     * rotationVariant means sender/receiver, not straight/curve, so drawing
     * it as a belt would show the wrong sprite entirely (found live on a
     * real device: tunnel spans previewed as random-looking belt curves).
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     * @param {PathEntry} entry
     */
    drawPreviewEntry(parameters, entry) {
        const metaBuilding = entry.isTunnel ? this.tunnelMetaBuilding : this.placerLogic.currentMetaBuilding.get();
        const fakeEntity = entry.isTunnel ? this.tunnelFakeEntity : this.placerLogic.fakeEntity;
        const variant = entry.isTunnel ? entry.tunnelVariant : this.placerLogic.currentVariant.get();
        const staticComp = fakeEntity.components.StaticMapEntity;

        // entry.rotation/rotationVariant (computed in beltTilesToEntries, or
        // explicitly by resolveBeltPath for a tunnel entry) already accounts
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
     * rotation matches what confirming will actually place) without the
     * bounding-box outline/ejector-arrow polish, which isn't needed at this
     * icon-sized scale.
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

        const staticComp = this.placerLogic.fakeEntity.components.StaticMapEntity;
        staticComp.origin = this.blueprintTile;
        staticComp.rotation = rotation;
        metaBuilding.updateVariants(this.placerLogic.fakeEntity, rotationVariant, variant);

        const canBuild = this.root.logic.checkCanPlaceEntity(this.placerLogic.fakeEntity, {});
        parameters.context.globalAlpha = canBuild ? 0.85 : 0.35;
        staticComp.drawSpriteOnBoundsClipped(
            parameters,
            metaBuilding.getBlueprintSprite(rotationVariant, variant)
        );
        parameters.context.globalAlpha = 1;
    }

    /**
     * @see BaseHUDPart.draw
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    draw(parameters) {
        if (this.blueprintTile && !this.isBeltSelected) {
            this.drawBlueprintGhost(parameters);
        }

        // Item 9: a completed-but-rejected belt (a tap or a released drag
        // resolveBeltPath couldn't make contiguous) blinks red for a moment
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
        this.element.style.setProperty("--toolbar-height", height + "px");
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

        if (this.invalidBeltFlash && this.root.time.realtimeNow() - this.invalidBeltFlash.startedAt > 0.6) {
            this.invalidBeltFlash = null;
        }

        this.element.classList.toggle("placing", !!this.placerLogic.currentMetaBuilding.get());
    }
}
