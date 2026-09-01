import { makeOffscreenBuffer } from "../../../core/buffer_utils";
import { ClickDetector } from "../../../core/click_detector";
import { globalConfig, IS_MOBILE } from "../../../core/config";
import { DrawParameters } from "../../../core/draw_parameters";
import { clamp, makeDiv, removeAllChildren } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { T } from "../../../translations";
import { getCodeFromBuildingData } from "../../building_codes";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { Entity } from "../../entity";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { defaultBuildingVariant } from "../../meta_building";
import { layers } from "../../root";
import { THEME } from "../../theme";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { HUDBuildingPlacerLogic } from "./building_placer_logic";

export class HUDBuildingPlacer extends HUDBuildingPlacerLogic {
    /**
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_PlacementHints", [], ``);

        this.buildingInfoElements = {};
        this.buildingInfoElements.label = makeDiv(this.element, null, ["buildingLabel"], "Extract");
        this.buildingInfoElements.desc = makeDiv(this.element, null, ["description"], "");
        this.buildingInfoElements.descText = makeDiv(this.buildingInfoElements.desc, null, ["text"], "");
        this.buildingInfoElements.additionalInfo = makeDiv(
            this.buildingInfoElements.desc,
            null,
            ["additionalInfo"],
            ""
        );
        this.buildingInfoElements.hotkey = makeDiv(this.buildingInfoElements.desc, null, ["hotkey"], "");
        this.buildingInfoElements.tutorialImage = makeDiv(this.element, null, ["buildingImage"]);

        this.variantsElement = makeDiv(parent, "ingame_HUD_PlacerVariants");

        const compact = this.root.app.settings.getAllSettings().compactBuildingInfo;
        this.element.classList.toggle("compact", compact);
        this.variantsElement.classList.toggle("compact", compact);
    }

    initialize() {
        super.initialize();

        // Bind to signals
        this.signals.variantChanged.add(this.rerenderVariants, this);
        this.root.hud.signals.buildingSelectedForPlacement.add(this.startSelection, this);

        this.domAttach = new DynamicDomAttach(this.root, this.element, { trackHover: true });
        this.variantsAttach = new DynamicDomAttach(this.root, this.variantsElement, {});

        this.currentInterpolatedCornerTile = new Vector();

        this.lockIndicatorSprites = {};
        [...layers, "error"].forEach(layer => {
            this.lockIndicatorSprites[layer] = this.makeLockIndicatorSprite(layer);
        });

        //

        /**
         * Stores the click detectors for the variants so we can clean them up later
         * @type {Array<ClickDetector>}
         */
        this.variantClickDetectors = [];
    }

    /**
     * Makes the lock indicator sprite for the given layer
     * @param {string} layer
     */
    makeLockIndicatorSprite(layer) {
        const dims = 48;
        const [canvas, context] = makeOffscreenBuffer(dims, dims, {
            smooth: true,
            reusable: false,
            label: "lock-direction-indicator",
        });

        context.fillStyle = THEME.map.directionLock[layer].color;
        context.strokeStyle = THEME.map.directionLock[layer].color;
        context.lineWidth = 2;

        const padding = 5;
        const height = dims * 0.5;
        const bottom = (dims + height) / 2;

        context.moveTo(padding, bottom);
        context.lineTo(dims / 2, bottom - height);
        context.lineTo(dims - padding, bottom);
        context.closePath();
        context.stroke();
        context.fill();

        return canvas;
    }

    /**
     * Rerenders the building info dialog
     */
    rerenderInfoDialog() {
        const metaBuilding = this.currentMetaBuilding.get();

        if (!metaBuilding) {
            return;
        }

        const variant = this.currentVariant.get();

        this.buildingInfoElements.label.innerHTML = T.buildings[metaBuilding.id][variant].name;
        this.buildingInfoElements.descText.innerHTML = T.buildings[metaBuilding.id][variant].description;

        const layer = this.root.currentLayer;

        let rawBinding = KEYMAPPINGS.buildings[metaBuilding.getId() + "_" + layer];
        if (!rawBinding) {
            rawBinding = KEYMAPPINGS.buildings[metaBuilding.getId()];
        }

        // Hotkey text is meaningless on mobile - it shows through the info
        // panel's own .mobileVisible re-attach (see building_placer.scss),
        // not hidden along with the rest of the desktop-only UI.
        if (rawBinding && !IS_MOBILE) {
            const binding = this.root.keyMapper.getBinding(rawBinding);
            this.buildingInfoElements.hotkey.innerHTML = T.ingame.buildingPlacement.hotkeyLabel.replace(
                "<key>",
                "<kbd>" + binding.getKeyCodeString() + "</kbd>"
            );
        } else {
            this.buildingInfoElements.hotkey.innerHTML = "";
        }

        this.buildingInfoElements.tutorialImage.setAttribute(
            "data-icon",
            "building_tutorials/" +
                metaBuilding.getId() +
                (variant === defaultBuildingVariant ? "" : "-" + variant) +
                ".png"
        );

        removeAllChildren(this.buildingInfoElements.additionalInfo);
        const additionalInfo = metaBuilding.getAdditionalStatistics(this.root, this.currentVariant.get());
        for (let i = 0; i < additionalInfo.length; ++i) {
            const [label, contents] = additionalInfo[i];
            this.buildingInfoElements.additionalInfo.innerHTML += `
                <label>${label}:</label>
                <span>${contents}</contents>
            `;
        }
    }

    cleanup() {
        super.cleanup();
        this.cleanupVariantClickDetectors();
    }

    /**
     * Cleans up all variant click detectors
     */
    cleanupVariantClickDetectors() {
        for (let i = 0; i < this.variantClickDetectors.length; ++i) {
            const detector = this.variantClickDetectors[i];
            detector.cleanup();
        }
        this.variantClickDetectors = [];
    }

    /**
     * Rerenders the variants displayed
     */
    rerenderVariants() {
        removeAllChildren(this.variantsElement);
        this.rerenderInfoDialog();

        const metaBuilding = this.currentMetaBuilding.get();

        // First, clear up all click detectors
        this.cleanupVariantClickDetectors();

        if (!metaBuilding) {
            return;
        }
        const availableVariants = metaBuilding.getAvailableVariants(this.root);
        if (availableVariants.length === 1) {
            return;
        }

        makeDiv(
            this.variantsElement,
            null,
            ["explanation"],
            T.ingame.buildingPlacement.cycleBuildingVariants.replace(
                "<key>",
                "<kbd>" +
                    this.root.keyMapper
                        .getBinding(KEYMAPPINGS.placement.rotateInverseModifier)
                        .getKeyCodeString() +
                    "</kbd>+<kbd class=\"rightMouse\"></kbd> / <kbd>" +
                    this.root.keyMapper
                        .getBinding(KEYMAPPINGS.placement.cycleBuildingVariants)
                        .getKeyCodeString() +
                    "</kbd>"
            )
        );

        const container = makeDiv(this.variantsElement, null, ["variants"]);

        for (let i = 0; i < availableVariants.length; ++i) {
            const variant = availableVariants[i];

            const element = makeDiv(container, null, ["variant"]);
            element.classList.toggle("active", variant === this.currentVariant.get());
            makeDiv(element, null, ["label"], variant);

            const iconSize = 64;

            const dimensions = metaBuilding.getDimensions(variant);
            const sprite = metaBuilding.getPreviewSprite(0, variant);
            const spriteWrapper = makeDiv(element, null, ["iconWrap"]);
            spriteWrapper.setAttribute("data-tile-w", String(dimensions.x));
            spriteWrapper.setAttribute("data-tile-h", String(dimensions.y));

            spriteWrapper.innerHTML = sprite.getAsHTML(iconSize * dimensions.x, iconSize * dimensions.y);

            const detector = new ClickDetector(element, {
                consumeEvents: true,
                targetOnly: true,
            });
            detector.click.add(() => this.setVariant(variant));
        }
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        if (this.root.camera.getIsMapOverlayActive()) {
            // Dont allow placing in overview mode
            this.domAttach.update(false);
            this.variantsAttach.update(false);
            return;
        }

        this.domAttach.update(!!this.currentMetaBuilding.get());
        this.variantsAttach.update(!!this.currentMetaBuilding.get());
        const metaBuilding = this.currentMetaBuilding.get();

        // Item 9: a completed-but-rejected belt drag (findBeltPath couldn't
        // make it contiguous) blinks red for a moment instead of anything
        // being placed - independent of whether a building is still selected.
        if (this.invalidBeltFlash) {
            this.drawInvalidBeltFlash(parameters);
        }

        if (!metaBuilding) {
            return;
        }

        // Draw direction lock
        if (this.isDirectionLockActive) {
            this.drawDirectionLock(parameters);
        } else if (this.isBeltSelected && this.currentlyDragging && this.beltDragStartTile) {
            this.drawBeltDragPreview(parameters);
        } else {
            this.drawRegularPlacement(parameters);
        }

        if (metaBuilding.getShowWiresLayerPreview()) {
            this.drawLayerPeek(parameters);
        }
    }

    /**
     * Item 9: live preview of the belt currently being dragged - either a
     * steady red tint over the whole attempted path (findBeltPath couldn't
     * make it contiguous) or a ghost of every entry it resolved to.
     * @param {DrawParameters} parameters
     */
    drawBeltDragPreview(parameters) {
        if (this.beltDragPreviewInvalid) {
            this.drawRedTiles(parameters, this.beltDragPath, 0.4);
            return;
        }
        if (this.beltDragPreviewEntries.length === 0) {
            return;
        }
        parameters.context.globalAlpha = 0.6;
        for (let i = 0; i < this.beltDragPreviewEntries.length; ++i) {
            this.drawPreviewEntry(parameters, this.beltDragPreviewEntries[i]);
        }
        parameters.context.globalAlpha = 1;
    }

    /**
     * Item 9 helper: flat red tint over a list of tiles - shared by the live
     * invalid-drag preview and the post-release blink flash below.
     * @param {DrawParameters} parameters
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
     * closer to an actual "blink" than one flat flash - see
     * HUDBuildingPlacerLogic.flashInvalidBelt.
     * @param {DrawParameters} parameters
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
     * A standalone fake entity for previewing tunnel pieces (see
     * drawPreviewEntry) - separate from this.fakeEntity, which only ever has
     * belt's own components (it's built for whatever building is actually
     * selected, always belt while any of this matters) and would throw if a
     * tunnel's updateVariants() tried to touch a
     * UndergroundBelt/ItemAcceptor/ItemEjector setup it doesn't have.
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

    /**
     * Draws a semi-transparent copy of the real building sprite at the given
     * tile/rotation - a tunnel entry (see BeltPathPlanner.findBeltPath) uses
     * its own fake entity and the tunnel building/variant instead of belt's,
     * since its rotationVariant means sender/receiver, not straight/curve.
     * @param {DrawParameters} parameters
     * @param {import("./belt_path_planner").PathEntry} entry
     */
    drawPreviewEntry(parameters, entry) {
        const metaBuilding = entry.isTunnel ? this.beltPathPlanner.tunnelMetaBuilding : this.currentMetaBuilding.get();
        const fakeEntity = entry.isTunnel ? this.tunnelFakeEntity : this.fakeEntity;
        const variant = entry.isTunnel ? entry.tunnelVariant : this.currentVariant.get();
        const staticComp = fakeEntity.components.StaticMapEntity;

        staticComp.origin = entry.tile;
        staticComp.rotation = entry.rotation;
        metaBuilding.updateVariants(fakeEntity, entry.rotationVariant, variant);

        staticComp.drawSpriteOnBoundsClipped(
            parameters,
            metaBuilding.getBlueprintSprite(entry.rotationVariant, variant)
        );
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    drawLayerPeek(parameters) {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const worldPosition = this.root.camera.screenToWorld(mousePosition);

        // Draw peeker
        if (this.root.hud.parts.layerPreview) {
            this.root.hud.parts.layerPreview.renderPreview(
                parameters,
                worldPosition,
                1 / this.root.camera.zoomLevel
            );
        }
    }

    /**
     * @param {DrawParameters} parameters
     */
    drawRegularPlacement(parameters) {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const metaBuilding = this.currentMetaBuilding.get();

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const mouseTile = worldPos.toTileSpace();

        // Compute best rotation variant
        const { rotation, rotationVariant, connectedEntities } =
            metaBuilding.computeOptimalDirectionAndRotationVariantAtTile({
                root: this.root,
                tile: mouseTile,
                rotation: this.currentBaseRotation,
                variant: this.currentVariant.get(),
                layer: metaBuilding.getLayer(),
            });

        // Check if there are connected entities
        if (connectedEntities) {
            for (let i = 0; i < connectedEntities.length; ++i) {
                const connectedEntity = connectedEntities[i];
                const connectedWsPoint = connectedEntity.components.StaticMapEntity.getTileSpaceBounds()
                    .getCenter()
                    .toWorldSpace();

                const startWsPoint = mouseTile.toWorldSpaceCenterOfTile();

                const startOffset = connectedWsPoint
                    .sub(startWsPoint)
                    .normalize()
                    .multiplyScalar(globalConfig.tileSize * 0.3);
                const effectiveStartPoint = startWsPoint.add(startOffset);
                const effectiveEndPoint = connectedWsPoint.sub(startOffset);

                parameters.context.globalAlpha = 0.6;

                // parameters.context.lineCap = "round";
                parameters.context.strokeStyle = "#7f7";
                parameters.context.lineWidth = 10;
                parameters.context.beginPath();
                parameters.context.moveTo(effectiveStartPoint.x, effectiveStartPoint.y);
                parameters.context.lineTo(effectiveEndPoint.x, effectiveEndPoint.y);
                parameters.context.stroke();
                parameters.context.globalAlpha = 1;
                // parameters.context.lineCap = "square";
            }
        }

        // Synchronize rotation and origin
        this.fakeEntity.layer = metaBuilding.getLayer();
        const staticComp = this.fakeEntity.components.StaticMapEntity;
        staticComp.origin = mouseTile;
        staticComp.rotation = rotation;
        metaBuilding.updateVariants(this.fakeEntity, rotationVariant, this.currentVariant.get());
        staticComp.code = getCodeFromBuildingData(
            this.currentMetaBuilding.get(),
            this.currentVariant.get(),
            rotationVariant
        );

        const canBuild = this.root.logic.checkCanPlaceEntity(this.fakeEntity, {});

        // Fade in / out
        parameters.context.lineWidth = 1;

        // Determine the bounds and visualize them
        const entityBounds = staticComp.getTileSpaceBounds();
        const drawBorder = -3;
        if (canBuild) {
            parameters.context.strokeStyle = "rgba(56, 235, 111, 0.5)";
            parameters.context.fillStyle = "rgba(56, 235, 111, 0.2)";
        } else {
            parameters.context.strokeStyle = "rgba(255, 0, 0, 0.2)";
            parameters.context.fillStyle = "rgba(255, 0, 0, 0.2)";
        }

        parameters.context.beginPath();
        parameters.context.roundRect(
            entityBounds.x * globalConfig.tileSize - drawBorder,
            entityBounds.y * globalConfig.tileSize - drawBorder,
            entityBounds.w * globalConfig.tileSize + 2 * drawBorder,
            entityBounds.h * globalConfig.tileSize + 2 * drawBorder,
            4
        );
        parameters.context.stroke();
        // parameters.context.fill();
        parameters.context.globalAlpha = 1;

        // HACK to draw the entity sprite
        const previewSprite = metaBuilding.getBlueprintSprite(rotationVariant, this.currentVariant.get());
        staticComp.origin = worldPos.divideScalar(globalConfig.tileSize).subScalars(0.5, 0.5);
        staticComp.drawSpriteOnBoundsClipped(parameters, previewSprite);
        staticComp.origin = mouseTile;

        // Draw ejectors
        if (canBuild) {
            this.drawMatchingAcceptorsAndEjectors(parameters);
        }
    }

    /**
     * Checks if there are any entities in the way, returns true if there are
     * @param {Vector} from
     * @param {Vector} to
     * @param {Vector[]=} ignorePositions
     * @returns
     */
    checkForObstales(from, to, ignorePositions = []) {
        assert(from.x === to.x || from.y === to.y, "Must be a straight line");

        const prop = from.x === to.x ? "y" : "x";
        const current = from.copy();

        const metaBuilding = this.currentMetaBuilding.get();
        this.fakeEntity.layer = metaBuilding.getLayer();
        const staticComp = this.fakeEntity.components.StaticMapEntity;
        staticComp.origin = current;
        staticComp.rotation = 0;
        metaBuilding.updateVariants(this.fakeEntity, 0, this.currentVariant.get());
        staticComp.code = getCodeFromBuildingData(
            this.currentMetaBuilding.get(),
            this.currentVariant.get(),
            0
        );

        const start = Math.min(from[prop], to[prop]);
        const end = Math.max(from[prop], to[prop]);

        for (let i = start; i <= end; i++) {
            current[prop] = i;
            if (ignorePositions.some(p => p.distanceSquare(current) < 0.1)) {
                continue;
            }
            if (!this.root.logic.checkCanPlaceEntity(this.fakeEntity, { allowReplaceBuildings: false })) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param {DrawParameters} parameters
     */
    drawDirectionLock(parameters) {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return;
        }

        const applyStyles = look => {
            parameters.context.fillStyle = THEME.map.directionLock[look].color;
            parameters.context.strokeStyle = THEME.map.directionLock[look].background;
            parameters.context.lineWidth = 10;
        };

        if (!this.lastDragTile) {
            // Not dragging yet
            applyStyles(this.root.currentLayer);
            const mouseWorld = this.root.camera.screenToWorld(mousePosition);
            parameters.context.beginCircle(mouseWorld.x, mouseWorld.y, 4);
            parameters.context.fill();
            return;
        }

        const mouseWorld = this.root.camera.screenToWorld(mousePosition);
        const mouseTile = mouseWorld.toTileSpace();
        const startLine = this.lastDragTile.toWorldSpaceCenterOfTile();
        const endLine = mouseTile.toWorldSpaceCenterOfTile();
        const midLine = this.currentDirectionLockCorner.toWorldSpaceCenterOfTile();
        const anyObstacle =
            this.checkForObstales(this.lastDragTile, this.currentDirectionLockCorner, [
                this.lastDragTile,
                mouseTile,
            ]) ||
            this.checkForObstales(this.currentDirectionLockCorner, mouseTile, [this.lastDragTile, mouseTile]);

        if (anyObstacle) {
            applyStyles("error");
        } else {
            applyStyles(this.root.currentLayer);
        }

        parameters.context.beginCircle(mouseWorld.x, mouseWorld.y, 4);
        parameters.context.fill();

        parameters.context.beginCircle(startLine.x, startLine.y, 8);
        parameters.context.fill();

        parameters.context.beginPath();
        parameters.context.moveTo(startLine.x, startLine.y);
        parameters.context.lineTo(midLine.x, midLine.y);
        parameters.context.lineTo(endLine.x, endLine.y);
        parameters.context.stroke();

        parameters.context.beginCircle(endLine.x, endLine.y, 5);
        parameters.context.fill();

        // Draw arrow
        const arrowSprite = this.lockIndicatorSprites[anyObstacle ? "error" : this.root.currentLayer];
        const path = this.computeDirectionLockPath();
        for (let i = 0; i < path.length - 1; i += 1) {
            const { rotation, tile } = path[i];
            const worldPos = tile.toWorldSpaceCenterOfTile();
            const angle = Math.radians(rotation);

            parameters.context.translate(worldPos.x, worldPos.y);
            parameters.context.rotate(angle);
            parameters.context.drawImage(
                arrowSprite,
                -6,
                -globalConfig.halfTileSize -
                    clamp((this.root.time.realtimeNow() * 1.5) % 1.0, 0, 1) * 1 * globalConfig.tileSize +
                    globalConfig.halfTileSize -
                    6,
                12,
                12
            );
            parameters.context.rotate(-angle);
            parameters.context.translate(-worldPos.x, -worldPos.y);
        }
    }

}
