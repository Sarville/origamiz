import { makeOffscreenBuffer } from "../../../core/buffer_utils";
import { globalConfig, IS_MOBILE } from "../../../core/config";
import { DrawParameters } from "../../../core/draw_parameters";
import { ClickDetector, MAX_MOVE_DISTANCE_PX } from "../../../core/click_detector";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { Loader } from "../../../core/loader";
import { Dialog, DialogWithForm } from "../../../core/modal_dialog_elements";
import { FormElementInput } from "../../../core/modal_dialog_forms";
import { Rectangle } from "../../../core/rectangle";
import { STOP_PROPAGATION } from "../../../core/signal";
import {
    arrayDeleteValue,
    lerp,
    makeDiv,
    removeAllChildren,
} from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { generateRandomShapeKey } from "../../../states/shape_viewer_tool";
import { T } from "../../../translations";
import { BaseItem } from "../../base_item";
import { MetaHubBuilding } from "../../buildings/hub";
import { enumMouseButton } from "../../camera";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { ShapeDefinition } from "../../shape_definition";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { enumNotificationType } from "./notifications";

/** @typedef {{
 *   label: string | null,
 *   center: { x: number, y: number },
 *   zoomLevel: number,
 *   layer: Layer,
 * }} Waypoint */

/**
 * Used when a shape icon is rendered instead
 */
const MAX_LABEL_LENGTH = 71;

/**
 * How long a press on an on-map marker has to be held before it opens the
 * edit dialog instead of jumping there - the on-map equivalent of desktop's
 * right-click-to-edit, for touch (which has no right-click). A quick
 * tap/click released before this still jumps immediately, same as before.
 */
const LONG_PRESS_EDIT_MS = 450;

export class HUDWaypoints extends BaseHUDPart {
    /**
     * Creates the overview of waypoints
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        // Create the helper box - on desktop this describes the mouse-button/
        // keyboard shortcut and sits in the lower right when zooming out; on
        // mobile there's no such shortcut (creation goes through the on-screen
        // button below instead), so it explains that instead and sits in the
        // lower left, out of the way of the bottom-right overview-zoom
        // building placement UI (see overview_building.js).
        if (this.root.app.settings.getAllSettings().offerHints) {
            this.hintElement = makeDiv(
                parent,
                "ingame_HUD_Waypoints_Hint",
                IS_MOBILE ? ["mobile"] : [],
                IS_MOBILE
                    ? `
            <strong class='title'>${T.ingame.waypoints.waypoints}</strong>
            <span class='desc'>${T.ingame.waypoints.descriptionMobile}</span>
        `
                    : `
            <strong class='title'>${T.ingame.waypoints.waypoints}</strong>
            <span class='desc'>${T.ingame.waypoints.description.replace(
                "<keybinding>",
                `<kbd>${this.root.keyMapper
                    .getBinding(KEYMAPPINGS.navigation.createMarker)
                    .getKeyCodeString()}</kbd>`
            )}</span>
        `
            );
        }

        // Create the waypoint list on the upper right
        this.waypointsListElement = makeDiv(
            parent,
            "ingame_HUD_Waypoints",
            IS_MOBILE ? ["mobile"] : [],
            "Waypoints"
        );

        // Mobile: no keybinding and no right-click to create a marker, so a
        // dedicated on-screen button starts a position-picker instead - a
        // marker icon fixed at the screen center while the map can still be
        // panned freely underneath (see onMobileAddMarkerClicked), confirmed
        // or cancelled via the row of buttons that appears beneath it.
        if (IS_MOBILE) {
            // Not this.trackClicks/this.clickDetectors: rerenderWaypointList()
            // calls this.cleanupClickDetectors() (a *shared* per-part array)
            // every time the marker list changes, which would silently kill
            // these buttons' listeners the first time a marker gets added,
            // renamed or deleted (found the hard way - the detector survives
            // as a dead, still-DOM-attached listener that swallows every
            // future tap). These persist independently instead.
            this.mobileClickDetectors = [];

            this.mobileAddButton = document.createElement("button");
            this.mobileAddButton.id = "ingame_HUD_Waypoints_MobileAdd";
            parent.appendChild(this.mobileAddButton);
            this.trackMobileClick(this.mobileAddButton, this.onMobileAddMarkerClicked);

            this.mobilePickerElement = makeDiv(
                parent,
                "ingame_HUD_Waypoints_MobilePicker",
                [],
                `<div class="markerIcon"></div>`
            );

            this.mobilePickerControls = makeDiv(this.mobilePickerElement, null, ["controls"]);

            this.mobilePickerCancelButton = document.createElement("button");
            this.mobilePickerCancelButton.classList.add("cancel");
            this.mobilePickerControls.appendChild(this.mobilePickerCancelButton);
            this.trackMobileClick(this.mobilePickerCancelButton, this.onMobilePickCancelled);

            this.mobilePickerConfirmButton = document.createElement("button");
            this.mobilePickerConfirmButton.classList.add("confirm");
            this.mobilePickerControls.appendChild(this.mobilePickerConfirmButton);
            this.trackMobileClick(this.mobilePickerConfirmButton, this.onMobilePickConfirmed);
        }
    }

    /**
     * Like this.trackClicks, but kept out of this.clickDetectors - see the
     * comment in createElements for why.
     * @param {HTMLElement} element
     * @param {() => void} handler
     */
    trackMobileClick(element, handler) {
        const detector = new ClickDetector(element, {});
        detector.click.add(handler, this);
        this.mobileClickDetectors.push(detector);
    }

    /**
     * @see BaseHUDPart.cleanup
     */
    cleanup() {
        super.cleanup();
        if (this.mobileClickDetectors) {
            for (let i = 0; i < this.mobileClickDetectors.length; ++i) {
                this.mobileClickDetectors[i].cleanup();
            }
            this.mobileClickDetectors = [];
        }
        this.clearPendingEdit();
    }

    /**
     * Serializes the waypoints
     */
    serialize() {
        return {
            waypoints: this.waypoints,
        };
    }

    /**
     * Deserializes the waypoints
     * @param {{waypoints: Array<Waypoint>}} data
     */
    deserialize(data) {
        if (!data || !data.waypoints || !Array.isArray(data.waypoints)) {
            return "Invalid waypoints data";
        }
        this.waypoints = data.waypoints;
        this.rerenderWaypointList();
    }

    /**
     * Initializes everything
     */
    initialize() {
        // Cache the sprite for the waypoints

        this.waypointSprites = {
            regular: Loader.getSprite("sprites/misc/waypoint.png"),
            wires: Loader.getSprite("sprites/misc/waypoint_wires.png"),
        };

        this.directionIndicatorSprite = Loader.getSprite("sprites/misc/hub_direction_indicator.png");

        /** @type {Array<Waypoint>} */
        this.waypoints = [];
        this.waypoints.push({
            label: null,
            center: { x: 0, y: 0 },
            zoomLevel: 3,
            layer: gMetaBuildingRegistry.findByClass(MetaHubBuilding).getLayer(),
        });

        // Create a buffer we can use to measure text
        this.dummyBuffer = makeOffscreenBuffer(1, 1, {
            reusable: false,
            label: "waypoints-measure-canvas",
        })[1];

        // Dynamically attach/detach the hint in the map overview
        if (this.hintElement) {
            this.domAttach = new DynamicDomAttach(this.root, this.hintElement);
        }

        // Mobile: the add-marker button only makes sense zoomed out into map
        // overview, same as the hint above - hidden the instant a pick is in
        // progress too, so it can't be tapped again mid-pick.
        if (this.mobileAddButton) {
            this.mobileAddDomAttach = new DynamicDomAttach(this.root, this.mobileAddButton);
        }
        this.mobilePickingActive = false;

        // Mobile: the waypoint currently tapped-and-expanded in the list
        // (upper right), revealing its pencil hit-target - see
        // rerenderWaypointList. Unrelated to the on-map overlay, which
        // jumps on a quick tap/click and opens editing on a held one - see
        // onMouseDown/onMouseUp and pendingEditWaypoint below.
        /** @type {Waypoint} */
        this.selectedMobileWaypoint = null;

        // A marker press-and-held on the map, waiting to see whether it's
        // released quickly (jump, see onMouseUp) or held past
        // LONG_PRESS_EDIT_MS (edit, see triggerPendingEdit) - the on-map
        // equivalent of desktop's right-click-to-edit, for touch (which has
        // no right-click).
        /** @type {Waypoint} */
        this.pendingEditWaypoint = null;
        this.pendingEditPos = null;
        this.pendingEditTimer = null;

        // Catch mouse and key events
        this.root.camera.downPreHandler.add(this.onMouseDown, this);
        this.root.camera.movePreHandler.add(this.onMouseMove, this);
        this.root.camera.upPostHandler.add(this.onMouseUp, this);
        this.root.keyMapper
            .getBinding(KEYMAPPINGS.navigation.createMarker)
            .add(() => this.requestSaveMarker({}));

        /**
         * Stores at how much opacity the markers should be rendered on the map.
         * This is interpolated over multiple frames so we have some sort of fade effect
         */
        this.currentMarkerOpacity = 1;
        this.currentCompassOpacity = 0;

        // Create buffer which is used to indicate the hub direction
        const [canvas, context] = makeOffscreenBuffer(48, 48, {
            smooth: true,
            reusable: false,
            label: "waypoints-compass",
        });
        this.compassBuffer = { canvas, context };

        /**
         * Stores a cache from a shape short key to its canvas representation
         */
        this.cachedKeyToCanvas = {};

        /**
         * Store cached text widths
         * @type {Object<string, number>}
         */
        this.cachedTextWidths = {};

        // Initial render
        this.rerenderWaypointList();
    }

    /**
     * Returns how long a text will be rendered
     * @param {string} text
     * @returns {number}
     */
    getTextWidth(text) {
        if (this.cachedTextWidths[text]) {
            return this.cachedTextWidths[text];
        }

        this.dummyBuffer.font = "bold " + this.getTextScale() + "px GameFont";
        return (this.cachedTextWidths[text] = this.dummyBuffer.measureText(text).width);
    }

    /**
     * Returns how big the text should be rendered
     */
    getTextScale() {
        return this.getWaypointUiScale() * 12;
    }

    /**
     * Returns the scale for rendering waypoints
     */
    getWaypointUiScale() {
        return this.root.app.getEffectiveUiScale();
    }

    /**
     * Re-renders the waypoint list to account for changes
     */
    rerenderWaypointList() {
        removeAllChildren(this.waypointsListElement);
        this.cleanupClickDetectors();

        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];
            const label = this.getWaypointLabel(waypoint);
            const isHub = !waypoint.label;
            const isShapeIcon = !isHub && ShapeDefinition.isValidShortKey(label);
            const deletable = this.isWaypointDeletable(waypoint);
            // Never true for the hub - it isn't deletable, so there's
            // nothing for it to expand into (see below).
            const isSelected = IS_MOBILE && deletable && this.selectedMobileWaypoint === waypoint;

            const element = makeDiv(this.waypointsListElement, null, [
                "waypoint",
                "layer--" + waypoint.layer,
            ]);

            // The location icon: the hub's own compass canvas doubles as
            // its icon (as it always has), everything else gets a real
            // ".icon" pin element - a CSS background-image on the row
            // itself used to do this job, but that can't be sized/animated
            // independently from a shape-icon marker's name (see
            // labelTarget below), which the "selected" state needs to do.
            let iconTarget;
            if (isHub) {
                element.insertBefore(this.compassBuffer.canvas, null);
                iconTarget = this.compassBuffer.canvas;
            } else {
                iconTarget = makeDiv(element, null, ["icon"]);
            }

            // The name: either the shape canvas (for a marker named after a
            // shape) or a text label - a real element in both cases (not
            // innerText, which would silently wipe the icon/canvas node
            // already appended above) so it can be its own tap target on
            // mobile, distinct from the icon (see the click wiring below).
            let labelTarget;
            if (isShapeIcon) {
                const canvas = this.getWaypointCanvas(waypoint);
                /**
                 * Create a clone of the cached canvas, as calling appendElement when a canvas is
                 * already in the document will move the existing canvas to the new position.
                 */
                const [newCanvas, context] = makeOffscreenBuffer(48, 48, {
                    smooth: true,
                    label: label + "-waypoint-" + i,
                });
                context.drawImage(canvas, 0, 0);
                element.appendChild(newCanvas);
                element.classList.add("shapeIcon");
                labelTarget = newCanvas;
            } else {
                // Mobile: a short preview (like the reference this was
                // modeled on) until expanded, then the full name.
                const displayLabel =
                    IS_MOBILE && !isSelected && label.length > 6 ? label.slice(0, 6) + "…" : label;
                labelTarget = makeDiv(element, null, ["label"], displayLabel);
            }

            // Desktop always shows it (deletable alone); mobile only once
            // selected - not just hidden via CSS display:none, genuinely
            // absent from the DOM until then, since a display:none button
            // was still visibly padding the collapsed chip out to nearly its
            // expanded width (measured directly: a lone 18px icon and an
            // icon+hidden-pencil pair rendered at almost the same overall
            // row width either way).
            if (deletable && (!IS_MOBILE || isSelected)) {
                const editButton = makeDiv(element, null, ["editButton"]);
                this.trackClicks(editButton, () => {
                    // Actually collapse now (not just mark the state), since
                    // closing the dialog without renaming/deleting doesn't
                    // itself trigger a rerender (only renameWaypoint/
                    // deleteWaypoint/addWaypoint do) - leaving the state
                    // reset but the DOM still showing the expanded chip and
                    // its editButton, which then also fails the "already
                    // selectedMobileWaypoint === null" check in onMouseDown,
                    // so tapping the map couldn't fix it either.
                    this.selectedMobileWaypoint = null;
                    this.rerenderWaypointList();
                    this.requestSaveMarker({ waypoint });
                });
            }

            if (isHub) {
                element.classList.add("hub");
            }

            if (IS_MOBILE) {
                element.classList.toggle("selected", isSelected);

                // iconTarget and labelTarget are always their own distinct
                // real elements now (the compass canvas / icon div, and the
                // shape canvas / label div respectively) - no more falling
                // back to binding `element` itself, so no targetOnly
                // juggling is needed either.
                if (!deletable) {
                    // Hub (or anything else non-editable): no expand state
                    // at all, tapping anywhere always jumps straight there,
                    // same as a desktop click always has.
                    const jump = () => this.moveToWaypoint(waypoint);
                    this.trackClicks(iconTarget, jump);
                    this.trackClicks(labelTarget, jump);
                } else if (!isSelected) {
                    // Collapsed: the icon or the label both just expand it -
                    // there's nothing to distinguish between yet.
                    const expand = () => {
                        this.selectedMobileWaypoint = waypoint;
                        this.rerenderWaypointList();
                    };
                    this.trackClicks(iconTarget, expand);
                    this.trackClicks(labelTarget, expand);
                } else {
                    // Expanded: the icon jumps there, the label collapses
                    // back to the short preview instead - mirrors
                    // requestSaveMarker's own dialog having a separate "ok"
                    // vs its close button.
                    const collapse = () => {
                        this.selectedMobileWaypoint = null;
                        this.rerenderWaypointList();
                    };
                    this.trackClicks(iconTarget, () => this.moveToWaypoint(waypoint));
                    this.trackClicks(labelTarget, collapse);
                }
            } else {
                this.trackClicks(element, () => this.moveToWaypoint(waypoint), {
                    targetOnly: true,
                });
            }
        }
    }

    /**
     * Moves the camera to a given waypoint
     * @param {Waypoint} waypoint
     */
    moveToWaypoint(waypoint) {
        this.root.currentLayer = waypoint.layer;
        this.root.camera.setDesiredCenter(new Vector(waypoint.center.x, waypoint.center.y));
        this.root.camera.setDesiredZoom(waypoint.zoomLevel);
    }

    /**
     * Deletes a waypoint from the list
     * @param {Waypoint} waypoint
     */
    deleteWaypoint(waypoint) {
        arrayDeleteValue(this.waypoints, waypoint);
        this.rerenderWaypointList();
    }

    /**
     * Gets the canvas for a given waypoint
     * @param {Waypoint} waypoint
     * @returns {HTMLCanvasElement}
     */
    getWaypointCanvas(waypoint) {
        const key = waypoint.label;
        if (this.cachedKeyToCanvas[key]) {
            return this.cachedKeyToCanvas[key];
        }

        assert(ShapeDefinition.isValidShortKey(key), "Invalid short key: " + key);
        const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(key);
        const preRendered = definition.generateAsCanvas(48);
        return (this.cachedKeyToCanvas[key] = preRendered);
    }

    /**
     * Requests to save a marker at the current camera position. If worldPos is set,
     * uses that position instead.
     * @param {object} param0
     * @param {Vector=} param0.worldPos Override the world pos, otherwise it is the camera position
     * @param {Waypoint=} param0.waypoint Waypoint to be edited. If omitted, create new
     */
    requestSaveMarker({ worldPos = null, waypoint = null }) {
        // Construct dialog with input field
        const markerNameInput = new FormElementInput({
            id: "markerName",
            label: null,
            placeholder: "",
            defaultValue: waypoint ? waypoint.label : "",
            validator: val =>
                val.length > 0 && (val.length < MAX_LABEL_LENGTH || ShapeDefinition.isValidShortKey(val)),
        });
        const dialog = new DialogWithForm({
            app: this.root.app,
            title: waypoint ? T.dialogs.createMarker.titleEdit : T.dialogs.createMarker.title,
            desc: T.dialogs.createMarker.desc
                .replace("<link>", '<span class="shapeKeyGeneratorLink">')
                .replace("</link>", "</span>"),
            formElements: [markerNameInput],
            buttons: waypoint ? ["delete:bad", "cancel", "ok:good"] : ["cancel", "ok:good"],
        });
        this.root.hud.parts.dialogs.internalShowDialog(dialog);

        // "generate here" - opens the shape key generator as a second dialog
        // stacked on top (HUDModalDialogs.internalShowDialog hides this one
        // underneath instead of closing it, and re-shows it once the
        // generator is closed), so the in-progress marker name isn't lost.
        const linkElem = dialog.dialogElem.querySelector(".shapeKeyGeneratorLink");
        if (linkElem) {
            dialog.trackClicks(linkElem, () =>
                this.showShapeKeyGeneratorDialog(key => markerNameInput.setValue(key))
            );
        }

        // Edit marker
        if (waypoint) {
            dialog.buttonSignals.ok.add(() => {
                // Actually rename the waypoint
                this.renameWaypoint(waypoint, markerNameInput.getValue());
            });
            dialog.buttonSignals.delete.add(() => {
                // Actually delete the waypoint
                this.deleteWaypoint(waypoint);
            });
        } else {
            // Compute where to create the marker
            const center = worldPos || this.root.camera.center;

            dialog.buttonSignals.ok.add(() => {
                // Actually create the waypoint
                this.addWaypoint(markerNameInput.getValue(), center);
            });
        }
    }

    /**
     * Adds a new waypoint at the given location with the given label
     * @param {string} label
     * @param {Vector} position
     */
    addWaypoint(label, position) {
        this.waypoints.push({
            label,
            center: { x: position.x, y: position.y },
            zoomLevel: this.root.camera.zoomLevel,
            layer: this.root.currentLayer,
        });

        this.sortWaypoints();

        // Show notification about creation
        this.root.hud.signals.notification.dispatch(
            T.ingame.waypoints.creationSuccessNotification,
            enumNotificationType.success
        );

        // Re-render the list and thus add it
        this.rerenderWaypointList();
    }

    /**
     * Renames a waypoint with the given label
     * @param {Waypoint} waypoint
     * @param {string} label
     */
    renameWaypoint(waypoint, label) {
        waypoint.label = label;

        this.sortWaypoints();

        // Show notification about renamed
        this.root.hud.signals.notification.dispatch(
            T.ingame.waypoints.creationSuccessNotification,
            enumNotificationType.success
        );

        // Re-render the list and thus add it
        this.rerenderWaypointList();
    }

    /**
     * Shows a compact shape short-key generator (live preview + randomize +
     * copy) as a dialog stacked on top of whatever's currently open - reuses
     * generateRandomShapeKey (shared with the full-page ShapeViewerToolState
     * reachable from Settings) so both places produce shapes the same way,
     * but without that page's instructions/examples section, which doesn't
     * fit a small stacked dialog.
     * @param {(key: string) => void=} onUseKey If given, shows an extra
     * "use this key" button that passes the current key to this callback and
     * closes the dialog - e.g. the createMarker dialog wires this to fill
     * its name field directly instead of requiring a manual copy/paste.
     */
    showShapeKeyGeneratorDialog(onUseKey = null) {
        const dialog = new Dialog({
            app: this.root.app,
            title: T.shapeViewerTool.title,
            contentHTML: `
                <div class="shapeKeyGenerator">
                    <p class="description">${T.shapeViewerTool.description}</p>
                    <label class="keyLabel">${T.shapeViewerTool.shortKey}</label>
                    <input type="text" class="shapeKeyInput" value="CuCuCuCu" spellcheck="false" autocomplete="off">
                    <p class="error hidden">${T.shapeViewerTool.invalid}</p>
                    <div class="previewArea"></div>
                    <div class="actions">
                        <button class="styledButton randomButton">${T.shapeViewerTool.randomize}</button>
                        <button class="styledButton copyButton">${T.shapeViewerTool.copy}</button>
                        ${
                            onUseKey
                                ? `<button class="styledButton useButton">${T.shapeViewerTool.useKey}</button>`
                                : ""
                        }
                    </div>
                </div>
            `,
            buttons: [],
            type: "info",
            closeButton: true,
        });
        this.root.hud.parts.dialogs.internalShowDialog(dialog);

        const contentElem = dialog.dialogElem;
        const keyInput = contentElem.querySelector(".shapeKeyInput");
        const previewArea = contentElem.querySelector(".previewArea");
        const errorElement = contentElem.querySelector(".error");

        const renderKey = () => {
            const key = keyInput.value.trim();
            if (!ShapeDefinition.isValidShortKey(key)) {
                removeAllChildren(previewArea);
                errorElement.classList.remove("hidden");
                return;
            }
            removeAllChildren(previewArea);
            previewArea.appendChild(ShapeDefinition.fromShortKey(key).generateAsCanvas(200));
            errorElement.classList.add("hidden");
        };

        keyInput.addEventListener("input", renderKey);

        dialog.trackClicks(contentElem.querySelector(".randomButton"), () => {
            keyInput.value = generateRandomShapeKey();
            renderKey();
        });

        dialog.trackClicks(contentElem.querySelector(".copyButton"), () => {
            const key = keyInput.value.trim();
            if (ShapeDefinition.isValidShortKey(key)) {
                navigator.clipboard.writeText(key);
            }
        });

        if (onUseKey) {
            dialog.trackClicks(contentElem.querySelector(".useButton"), () => {
                const key = keyInput.value.trim();
                if (!ShapeDefinition.isValidShortKey(key)) {
                    this.root.soundProxy.playUiError();
                    return;
                }
                onUseKey(key);
                // Same path the X button uses (see Dialog.createElement) -
                // pops back to whatever dialog was stacked underneath.
                dialog.internalButtonHandler("close-button");
            });
        }

        renderKey();
    }

    /**
     * Mobile: starts the position-picker (see createElements) - the marker
     * icon and confirm/cancel row become visible, the add button hides
     * itself the next frame (see update()/mobileAddDomAttach).
     */
    onMobileAddMarkerClicked() {
        this.mobilePickingActive = true;
        this.mobilePickerElement.classList.add("visible");
    }

    /**
     * Mobile: leaves the position-picker without creating anything.
     */
    onMobilePickCancelled() {
        this.mobilePickingActive = false;
        this.mobilePickerElement.classList.remove("visible");
    }

    /**
     * Mobile: leaves the position-picker and opens the usual name dialog -
     * the marker icon sat fixed at the screen center throughout, i.e. at
     * root.camera.center, which is exactly what an omitted worldPos
     * defaults to (see requestSaveMarker).
     */
    onMobilePickConfirmed() {
        this.onMobilePickCancelled();
        this.requestSaveMarker({});
    }

    /**
     * Called every frame to update stuff
     */
    update() {
        if (this.domAttach) {
            this.domAttach.update(this.root.camera.getIsMapOverlayActive());
        }
        if (this.mobileAddDomAttach) {
            this.mobileAddDomAttach.update(
                this.root.camera.getIsMapOverlayActive() && !this.mobilePickingActive
            );
        }
    }

    /**
     * Sort waypoints by name
     */
    sortWaypoints() {
        this.waypoints.sort((a, b) => {
            if (!a.label) {
                return -1;
            }
            if (!b.label) {
                return 1;
            }
            return this.getWaypointLabel(a)
                .padEnd(MAX_LABEL_LENGTH, "0")
                .localeCompare(this.getWaypointLabel(b).padEnd(MAX_LABEL_LENGTH, "0"));
        });
    }

    /**
     * Returns the label for a given waypoint
     * @param {Waypoint} waypoint
     * @returns {string}
     */
    getWaypointLabel(waypoint) {
        return waypoint.label || T.ingame.waypoints.hub;
    }

    /**
     * Returns if a waypoint is deletable
     * @param {Waypoint} waypoint
     * @returns {boolean}
     */
    isWaypointDeletable(waypoint) {
        return waypoint.label !== null;
    }

    /**
     * Returns the screen space bounds of the given waypoint or null
     * if it couldn't be determined. Also returns wheter its a shape or not
     * @param {Waypoint} waypoint
     * @return {{
     *   screenBounds: Rectangle
     *   item: BaseItem|null,
     *   text: string
     * }}
     */
    getWaypointScreenParams(waypoint) {
        if (!this.root.camera.getIsMapOverlayActive()) {
            return null;
        }

        // Find parameters
        const scale = this.getWaypointUiScale();
        const screenPos = this.root.camera.worldToScreen(new Vector(waypoint.center.x, waypoint.center.y));

        // Distinguish between text and item waypoints -> Figure out parameters
        const originalLabel = this.getWaypointLabel(waypoint);
        let text, item, textWidth;

        if (ShapeDefinition.isValidShortKey(originalLabel)) {
            // If the label is actually a key, render the shape icon
            item = this.root.shapeDefinitionMgr.getShapeItemFromShortKey(originalLabel);
            textWidth = 40;
        } else {
            // Otherwise render a regular waypoint
            text = originalLabel;
            textWidth = this.getTextWidth(text);
        }

        return {
            screenBounds: new Rectangle(
                screenPos.x - 7 * scale,
                screenPos.y - 12 * scale,
                15 * scale + textWidth,
                15 * scale
            ),
            item,
            text,
        };
    }

    /**
     * Finds the currently intersected waypoint on the map overview under
     * the given position, defaulting to the cursor.
     *
     * @param {Vector=} pos Defaults to root.app.mousePosition - only ever
     * set on desktop (see Application.registerEventListeners, gated behind
     * !IS_MOBILE), so a real tap position must be passed explicitly here on
     * mobile (see onMouseDown) or this would never find anything there.
     * @returns {Waypoint | null}
     */
    findCurrentIntersectedWaypoint(pos = this.root.app.mousePosition) {
        if (!pos) {
            return;
        }

        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];
            const params = this.getWaypointScreenParams(waypoint);
            if (params && params.screenBounds.containsPoint(pos.x, pos.y)) {
                return waypoint;
            }
        }
    }

    /**
     * Mouse-Down handler
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        // Mobile: tapping the map itself (as opposed to the waypoint list,
        // a separate DOM overlay a canvas tap can never land on) collapses
        // any expanded list entry back to its short preview.
        if (this.selectedMobileWaypoint) {
            this.selectedMobileWaypoint = null;
            this.rerenderWaypointList();
        }

        // Mobile passes its real tap position explicitly here since
        // app.mousePosition is never set there (see findCurrentIntersected
        // Waypoint's doc). The select-then-pencil flow is only in the
        // waypoint list (upper right), see rerenderWaypointList - this is
        // the separate on-map overlay.
        const waypoint = this.findCurrentIntersectedWaypoint(pos);
        if (waypoint) {
            if (button === enumMouseButton.left) {
                if (this.isWaypointDeletable(waypoint)) {
                    // Don't jump yet - wait to see whether this is a quick
                    // tap/click (jump, see onMouseUp) or held past
                    // LONG_PRESS_EDIT_MS (edit, see triggerPendingEdit).
                    // The hub has nothing to hold into (not editable), so it
                    // skips straight to jumping below instead.
                    this.clearPendingEdit();
                    this.pendingEditWaypoint = waypoint;
                    this.pendingEditPos = pos.copy();
                    this.pendingEditTimer = setTimeout(
                        () => this.triggerPendingEdit(),
                        LONG_PRESS_EDIT_MS
                    );
                } else {
                    this.root.soundProxy.playUiClick();
                    this.moveToWaypoint(waypoint);
                }
            } else if (button === enumMouseButton.right) {
                if (this.isWaypointDeletable(waypoint)) {
                    this.root.soundProxy.playUiClick();
                    this.requestSaveMarker({ waypoint });
                } else {
                    this.root.soundProxy.playUiError();
                }
            }

            return STOP_PROPAGATION;
        } else {
            // Allow right click to create a marker
            if (button === enumMouseButton.right) {
                if (this.root.camera.getIsMapOverlayActive()) {
                    const worldPos = this.root.camera.screenToWorld(pos);
                    this.requestSaveMarker({ worldPos });
                    return STOP_PROPAGATION;
                }
            }
        }
    }

    /**
     * @param {Vector} pos
     */
    onMouseMove(pos) {
        if (this.pendingEditPos && pos.sub(this.pendingEditPos).length() > MAX_MOVE_DISTANCE_PX) {
            // Moved too far to still count as holding on the same marker.
            this.clearPendingEdit();
        }
    }

    onMouseUp() {
        if (this.pendingEditWaypoint) {
            // Released before the long-press fired - a plain tap/click,
            // jump there immediately same as before.
            const waypoint = this.pendingEditWaypoint;
            this.clearPendingEdit();
            this.root.soundProxy.playUiClick();
            this.moveToWaypoint(waypoint);
        }
    }

    /**
     * Cancels a pending press-and-hold on a marker without acting on it -
     * called both when it resolves (jump or edit) and when it's interrupted
     * (finger moved away, part cleaned up).
     */
    clearPendingEdit() {
        if (this.pendingEditTimer) {
            clearTimeout(this.pendingEditTimer);
            this.pendingEditTimer = null;
        }
        this.pendingEditWaypoint = null;
        this.pendingEditPos = null;
    }

    /**
     * Fired after a marker has been held for LONG_PRESS_EDIT_MS - see
     * onMouseDown/clearPendingEdit.
     */
    triggerPendingEdit() {
        this.pendingEditTimer = null;
        const waypoint = this.pendingEditWaypoint;
        this.pendingEditWaypoint = null;
        this.pendingEditPos = null;
        if (!waypoint || this.root.camera.currentlyPinching) {
            // A second finger joined mid-hold (pinch-zoom) - not a hold on
            // this marker any more.
            return;
        }
        this.root.soundProxy.playUiClick();
        this.requestSaveMarker({ waypoint });
    }

    /**
     * Rerenders the compass
     */
    rerenderWaypointsCompass() {
        const dims = 48;
        const indicatorSize = 30;
        const cameraPos = this.root.camera.center;

        const context = this.compassBuffer.context;
        context.clearRect(0, 0, dims, dims);

        const distanceToHub = cameraPos.length();
        const compassVisible = distanceToHub > (10 * globalConfig.tileSize) / this.root.camera.zoomLevel;
        const targetCompassAlpha = compassVisible ? 1 : 0;

        // Fade the compas in / out
        this.currentCompassOpacity = lerp(this.currentCompassOpacity, targetCompassAlpha, 0.08);

        // Render the compass
        if (this.currentCompassOpacity > 0.01) {
            context.globalAlpha = this.currentCompassOpacity;
            const angle = cameraPos.angle() + Math.radians(45) + Math.PI / 2;
            context.translate(dims / 2, dims / 2);
            context.rotate(angle);
            this.directionIndicatorSprite.drawCentered(context, 0, 0, indicatorSize);
            context.rotate(-angle);
            context.translate(-dims / 2, -dims / 2);
            context.globalAlpha = 1;
        }

        // Render the regualr icon
        const iconOpacity = 1 - this.currentCompassOpacity;
        if (iconOpacity > 0.01) {
            context.globalAlpha = iconOpacity;
            this.waypointSprites.regular.drawCentered(context, dims / 2, dims / 2, dims * 0.7);
            context.globalAlpha = 1;
        }
    }

    /**
     * Draws the waypoints on the map
     * @param {DrawParameters} parameters
     */
    drawOverlays(parameters) {
        const mousePos = this.root.app.mousePosition;
        const desiredOpacity = this.root.camera.getIsMapOverlayActive() ? 1 : 0;
        this.currentMarkerOpacity = lerp(this.currentMarkerOpacity, desiredOpacity, 0.08);

        this.rerenderWaypointsCompass();

        // Don't render with low opacity
        if (this.currentMarkerOpacity < 0.01) {
            return;
        }

        // Determine rendering scale
        const scale = this.getWaypointUiScale();

        // Set the font size
        const textSize = this.getTextScale();
        parameters.context.font = "bold " + textSize + "px GameFont";
        parameters.context.textBaseline = "middle";

        // Loop over all waypoints
        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];

            const waypointData = this.getWaypointScreenParams(waypoint);
            if (!waypointData) {
                // Not relevant
                continue;
            }

            if (!parameters.visibleRect.containsRect(waypointData.screenBounds)) {
                // Out of screen
                continue;
            }

            const bounds = waypointData.screenBounds;
            const contentPaddingX = 7 * scale;
            const isSelected = mousePos && bounds.containsPoint(mousePos.x, mousePos.y);

            // Render the background rectangle
            parameters.context.globalAlpha = this.currentMarkerOpacity * (isSelected ? 1 : 0.7);
            parameters.context.fillStyle = "rgba(255, 255, 255, 0.7)";
            parameters.context.beginPath();
            parameters.context.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 6);
            parameters.context.fill();

            // Render the text
            if (waypointData.item) {
                const canvas = this.getWaypointCanvas(waypoint);
                const itemSize = 14 * scale;
                parameters.context.drawImage(
                    canvas,
                    bounds.x + contentPaddingX + 6 * scale,
                    bounds.y + bounds.h / 2 - itemSize / 2,
                    itemSize,
                    itemSize
                );
            } else if (waypointData.text) {
                // Render the text
                parameters.context.fillStyle = "#000";
                parameters.context.textBaseline = "middle";
                parameters.context.fillText(
                    waypointData.text,
                    bounds.x + contentPaddingX + 6 * scale,
                    bounds.y + bounds.h / 2
                );
                parameters.context.textBaseline = "alphabetic";
            } else {
                assertAlways(false, "Waypoint has no item and text");
            }

            // Render the small icon on the left
            this.waypointSprites[waypoint.layer].drawCentered(
                parameters.context,
                bounds.x + contentPaddingX,
                bounds.y + bounds.h / 2,
                bounds.h * 0.6
            );
        }

        parameters.context.textBaseline = "alphabetic";
        parameters.context.globalAlpha = 1;
    }
}
