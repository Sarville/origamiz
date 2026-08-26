import { MAX_MOVE_DISTANCE_PX } from "../../../core/click_detector";
import { STOP_PROPAGATION } from "../../../core/signal";
import { makeDiv } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { SOUNDS } from "../../../platform/sound";
import { T } from "../../../translations";
import { enumMouseButton } from "../../camera";
import { BaseHUDPart } from "../base_hud_part";

const ROTATION_ARROWS = {
    0: "↑",
    90: "→",
    180: "↓",
    270: "←",
};

// How long a finger has to stay down before it counts as "hold" (start laying a
// belt path) instead of "move" (pan the map) or "tap" (place a single tile).
const LONG_PRESS_MS = 350;

// How far (px) a swipe on the building preview has to travel before it's treated
// as "cycle the variant" instead of snapping back.
const SWIPE_THRESHOLD_PX = 30;

// How far (px) the preview slides out/in during the swipe animation. Arbitrary -
// just has to clear the (small) preview box.
const SWIPE_SLIDE_PX = 120;

/**
 * @typedef {{ tile: Vector, rotation: number, rotationVariant: number }} PathEntry
 */

/**
 * Touch controls for building placement. Buildings here are free (the point is
 * efficient layout, not cost), so there's no reason to stage a plan for later
 * confirmation - everything builds immediately, same as desktop. What's
 * different from desktop is the dragging: only belts support laying a path by
 * holding and dragging (previewed live as a semi-transparent copy of the real
 * sprite before it's committed on release); every other building is placed one
 * tile at a time by a plain tap, using whatever direction the rotate button is
 * currently showing. A plain move without holding first still pans the map.
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

        // Active state: preview of the selected building plus its controls,
        // styled like the buildings toolbar.
        this.previewPanel = makeDiv(this.element, null, ["buildingPreview"]);

        this.swipeHint = makeDiv(
            this.previewPanel,
            null,
            ["swipeHint"],
            T.ingame.buildingPlacement.swipeForVariants
        );

        // The actual building sprite (not the flat toolbar icon) - sized per its
        // real tile footprint via data-tile-w/h, same convention
        // HUDBuildingPlacer.rerenderVariants uses for its (desktop) variant icons.
        this.spriteWrap = makeDiv(this.previewPanel, null, ["spriteWrap"]);
        this.previewSprite = makeDiv(this.spriteWrap, null, ["sprite"]);

        const controls = makeDiv(this.previewPanel, null, ["controls"]);

        this.rotateButton = document.createElement("button");
        this.rotateButton.classList.add("rotate");
        this.rotateButton.innerText = "↑";
        controls.appendChild(this.rotateButton);
        this.trackClicks(this.rotateButton, this.onRotateClicked);

        this.multiplaceButton = document.createElement("button");
        this.multiplaceButton.classList.add("multiplace");
        this.multiplaceButton.innerText = "⧉";
        controls.appendChild(this.multiplaceButton);
        this.trackClicks(this.multiplaceButton, this.onMultiplaceClicked);

        this.cancelButton = document.createElement("button");
        this.cancelButton.classList.add("cancel");
        controls.appendChild(this.cancelButton);
        this.trackClicks(this.cancelButton, this.onCancelClicked);

        this.infoButton = document.createElement("button");
        this.infoButton.classList.add("info");
        controls.appendChild(this.infoButton);
        this.trackClicks(this.infoButton, this.onInfoClicked);
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
                this.panning = false;
            }
        };
        this.root.canvas.addEventListener("touchstart", this.cancelGestureOnSecondTouch);

        // Swipe-to-cycle-variants state for the building preview.
        this.swipeStartX = null;
        this.swipeOffset = 0;
        this.swipeAnimating = false;
        this.spriteWrap.addEventListener("touchstart", this.onSpriteTouchStart.bind(this), {
            passive: true,
        });
        this.spriteWrap.addEventListener("touchmove", this.onSpriteTouchMove.bind(this), {
            passive: false,
        });
        this.spriteWrap.addEventListener("touchend", this.onSpriteTouchEnd.bind(this));
        this.spriteWrap.addEventListener("touchcancel", this.onSpriteTouchEnd.bind(this));
    }

    onPlacementBuildingChanged(metaBuilding) {
        if (metaBuilding) {
            this.deleteModeActive = false;
            this.deleteButton.classList.remove("active");
        } else {
            // Nothing left to show info about.
            this.placementHintsElement.classList.remove("mobileVisible");
        }
        this.dragPreviewEntries = [];
        this.dragPath = [];
        this.dragging = false;
        this.clearPendingHold();
        this.panning = false;
    }

    get placerLogic() {
        return this.root.hud.parts.buildingPlacer;
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

    onInfoClicked() {
        // Toggles the same #ingame_HUD_PlacementHints panel desktop shows at the
        // top-right (kept hidden by default on mobile, see building_placer.scss) -
        // not a Dialog: HUDBuildingPlacerLogic.update() aborts the current
        // placement the instant HUDModalDialogs reports a blocking overlay open,
        // so a real modal here would silently deselect the building the moment
        // it's opened.
        this.placementHintsElement.classList.toggle("mobileVisible");
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
        const variant = this.placerLogic.currentVariant.get();
        const dimensions = metaBuilding.getDimensions(variant);

        // Matches HUDBuildingPlacer.rerenderVariants' convention for its (desktop)
        // variant icons - the actual pixel size just has to be proportional to the
        // real w:h footprint, the sprite markup positions itself with percentages.
        const iconSize = 64;
        const sprite = metaBuilding.getPreviewSprite(0, variant);
        this.previewSprite.setAttribute("data-tile-w", String(dimensions.x));
        this.previewSprite.setAttribute("data-tile-h", String(dimensions.y));
        this.previewSprite.innerHTML = sprite.getAsHTML(iconSize * dimensions.x, iconSize * dimensions.y);

        this.previewPanel.classList.toggle("hasVariants", metaBuilding.getAvailableVariants(this.root).length > 1);

        this.swipeStartX = null;
        this.swipeOffset = 0;
        this.swipeAnimating = false;
        this.previewSprite.style.transition = "none";
        this.applySpriteTransform();
    }

    /**
     * Applies the current rotation + in-progress swipe offset to the preview
     * sprite. Rotation is a plain CSS rotate of the (already oriented) preview
     * sprite - not pixel-perfect for non-square buildings, but close enough for a
     * preview and matches the desktop ghost preview's rotation behaviour.
     */
    applySpriteTransform() {
        const rotation = this.placerLogic.currentBaseRotation;
        this.previewSprite.style.transform = `translateX(${this.swipeOffset}px) rotate(${rotation}deg)`;
    }

    onSpriteTouchStart(event) {
        if (this.swipeAnimating) {
            return;
        }
        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding || metaBuilding.getAvailableVariants(this.root).length <= 1) {
            return;
        }
        this.swipeStartX = event.touches[0].clientX;
        this.swipeOffset = 0;
        this.previewSprite.style.transition = "none";
    }

    onSpriteTouchMove(event) {
        if (this.swipeStartX === null) {
            return;
        }
        event.preventDefault();
        this.swipeOffset = event.touches[0].clientX - this.swipeStartX;
        this.applySpriteTransform();
    }

    onSpriteTouchEnd() {
        if (this.swipeStartX === null) {
            return;
        }
        const offset = this.swipeOffset;
        this.swipeStartX = null;

        if (Math.abs(offset) > SWIPE_THRESHOLD_PX) {
            this.playSwipeAnimation(offset < 0 ? 1 : -1);
        } else {
            this.previewSprite.style.transition = "transform 0.15s ease";
            this.swipeOffset = 0;
            this.applySpriteTransform();
        }
    }

    /**
     * Slides the current preview out, swaps to the next/previous variant, then
     * slides the new one in from the opposite side.
     * @param {number} direction 1 for next variant, -1 for previous
     */
    playSwipeAnimation(direction) {
        this.swipeAnimating = true;
        const outOffset = direction > 0 ? -SWIPE_SLIDE_PX : SWIPE_SLIDE_PX;

        this.previewSprite.style.transition = "transform 0.15s ease";
        this.swipeOffset = outOffset;
        this.applySpriteTransform();

        setTimeout(() => {
            // Triggers currentVariant's TrackedState, which synchronously calls
            // renderPreview via the variantChanged signal - resetting
            // transition/offset to neutral, so jump to the opposite edge with no
            // transition, then animate back in.
            this.placerLogic.cycleVariants(direction);
            this.previewSprite.style.transition = "none";
            this.swipeOffset = -outOffset;
            this.applySpriteTransform();

            // Force a reflow so the transition change below doesn't get merged
            // with the jump above into a single (invisible) step.
            void this.previewSprite.offsetWidth;

            this.previewSprite.style.transition = "transform 0.15s ease";
            this.swipeOffset = 0;
            this.applySpriteTransform();

            setTimeout(() => {
                this.swipeAnimating = false;
            }, 160);
        }, 160);
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
    computeCornerPath(from, to) {
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        // Travel the dominant direction first, then correct with the smaller one.
        const corner = dx >= dy ? new Vector(to.x, from.y) : new Vector(from.x, to.y);
        const firstLeg = this.axisSegment(from, corner);
        const secondLeg = this.axisSegment(corner, to);
        return firstLeg.concat(secondLeg.slice(1));
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

            let rotation = outgoing;
            let rotationVariant = 0;
            if (i > 0) {
                const incoming = this.directionBetween(path[i - 1], path[i]);
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
            entries.push({ tile: path[i], rotation, rotationVariant });
        }
        return entries;
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
        if (this.placerLogic.tryPlaceCurrentBuildingAt(tile)) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
            // Most buildings deselect themselves after one placement (unless they
            // "stay in placement mode", like belts always do) - multiplace mode
            // means "keep going", so reselect if that just happened.
            if (this.multiplaceMode && !this.placerLogic.currentMetaBuilding.get()) {
                this.placerLogic.currentMetaBuilding.set(metaBuilding);
            }
        }
    }

    /**
     * Places every entry of a completed belt drag immediately.
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

        const savedRotation = this.placerLogic.currentBaseRotation;
        let anythingPlaced = false;

        this.root.logic.performBulkOperation(() => {
            for (let i = 0; i < entries.length; ++i) {
                // Belts always "stay in placement mode" so this shouldn't normally be
                // needed, but keep it as a safety net against a null-deref.
                if (!this.placerLogic.currentMetaBuilding.get()) {
                    this.placerLogic.currentMetaBuilding.set(metaBuilding);
                }
                const { tile, rotation } = entries[i];
                this.placerLogic.currentBaseRotation = rotation;
                if (this.placerLogic.tryPlaceCurrentBuildingAt(tile)) {
                    anythingPlaced = true;
                }
            }
        });

        this.placerLogic.currentBaseRotation = savedRotation;

        if (anythingPlaced) {
            this.root.soundProxy.playUi(metaBuilding.getPlacementSound());
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
            if (contents && this.root.logic.tryDeleteBuilding(contents)) {
                this.root.soundProxy.playUi(SOUNDS.destroyBuilding);
            }
            return STOP_PROPAGATION;
        }

        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding) {
            return;
        }

        // Always intercept from here on - HUDBuildingPlacerLogic must never place
        // immediately on its own, we decide in onMouseUp whether this was a tap or a
        // completed drag instead.
        this.clearPendingHold();
        this.pendingPos = pos;
        this.pendingTile = this.root.camera.screenToWorld(pos).toTileSpace();
        this.lastPanPos = pos;
        this.panning = false;
        if (this.isBeltSelected) {
            // Only belts support laying a path by holding+dragging - other buildings
            // are always placed one tile at a time by a plain tap.
            this.holdTimer = setTimeout(() => this.beginDrag(), LONG_PRESS_MS);
        }
        return STOP_PROPAGATION;
    }

    /**
     * @param {Vector} pos
     */
    onMouseMove(pos) {
        if (this.dragging) {
            const tile = this.root.camera.screenToWorld(pos).toTileSpace();
            const lastTile = this.dragPath[this.dragPath.length - 1];
            if (!tile.equals(lastTile)) {
                // Always recomputed from the press point to the current finger position -
                // not accumulated along wherever the finger physically travelled, which
                // just traces every wobble of a real finger instead of a clean path.
                this.dragPath = this.computeCornerPath(this.dragStartTile, tile);
                this.dragPreviewEntries = this.beltTilesToEntries(this.dragPath);
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
                // Moved too far before the hold fired (or, for non-belt buildings,
                // moved at all) - this is a pan, not a placement.
                this.clearPendingHold();
                this.panning = true;
                this.lastPanPos = pos;
            }
            return STOP_PROPAGATION;
        }
    }

    onMouseUp() {
        if (this.dragging) {
            this.dragging = false;
            if (this.dragPath.length <= 1) {
                // Held without ever moving - treat like a plain tap.
                this.placeSingle(
                    this.dragPath[0] || this.dragStartTile,
                    this.placerLogic.currentBaseRotation
                );
            } else {
                this.placePath(this.dragPreviewEntries);
            }
            this.dragPath = [];
            this.dragPreviewEntries = [];
            return;
        }

        if (this.pendingPos && !this.panning) {
            // Released without moving and without the hold firing - plain tap.
            this.placeSingle(this.pendingTile, this.placerLogic.currentBaseRotation);
        }
        this.clearPendingHold();
        this.panning = false;
    }

    /**
     * Draws a semi-transparent copy of the real building sprite at the given
     * tile/rotation - reuses the same fakeEntity + blueprint sprite mechanism
     * HUDBuildingPlacer uses for its (desktop, mouse-hover-driven) ghost preview.
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     * @param {MetaBuilding} metaBuilding
     * @param {PathEntry} entry
     */
    drawPreviewEntry(parameters, metaBuilding, entry) {
        const staticComp = this.placerLogic.fakeEntity.components.StaticMapEntity;
        const variant = this.placerLogic.currentVariant.get();

        // entry.rotation/rotationVariant (computed in beltTilesToEntries from the
        // dragged path itself) already account for curves. Querying
        // computeOptimalDirectionAndRotationVariantAtTile here instead would look at
        // *real* map neighbours, none of which exist yet since nothing is built.
        staticComp.origin = entry.tile;
        staticComp.rotation = entry.rotation;
        metaBuilding.updateVariants(this.placerLogic.fakeEntity, entry.rotationVariant, variant);

        staticComp.drawSpriteOnBoundsClipped(
            parameters,
            metaBuilding.getBlueprintSprite(entry.rotationVariant, variant)
        );
    }

    /**
     * @see BaseHUDPart.draw
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    draw(parameters) {
        if (this.dragPreviewEntries.length === 0) {
            return;
        }
        const metaBuilding = this.placerLogic.currentMetaBuilding.get();
        if (!metaBuilding) {
            return;
        }

        parameters.context.globalAlpha = 0.6;
        for (let i = 0; i < this.dragPreviewEntries.length; ++i) {
            this.drawPreviewEntry(parameters, metaBuilding, this.dragPreviewEntries[i]);
        }
        parameters.context.globalAlpha = 1;
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

        const isPlacingBuilding = !!this.placerLogic.currentMetaBuilding.get();

        this.element.classList.toggle("placing", isPlacingBuilding);
        if (!isPlacingBuilding) {
            return;
        }

        this.rotateButton.innerText = ROTATION_ARROWS[this.placerLogic.currentBaseRotation] || "↑";
        if (!this.swipeAnimating && this.swipeStartX === null) {
            this.applySpriteTransform();
        }
    }
}
