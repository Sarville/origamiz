import { globalConfig } from "../core/config";
import type { DrawParameters } from "../core/draw_parameters";
import { findNiceIntegerValue } from "../core/utils";
import { Vector } from "../core/vector";
import { buildEntityFromSerialized } from "../savegame/serializer_internal";
import type { Entity } from "./entity";
import type { GameRoot } from "./root";

export class Blueprint {
    /**
     * If set to true, the blueprint temporarily has no cost. This field is
     * reset by {@link tryPlace} if any building was successfully placed.
     */
    isNextPasteFree = false;

    constructor(private entities: Entity[]) {}

    /**
     * Returns the layer of this blueprint
     */
    get layer(): Layer {
        if (this.entities.length === 0) {
            return "regular";
        }
        return this.entities[0].layer;
    }

    /**
     * Creates a new blueprint from the given entity uids
     */
    static fromUids(root: GameRoot, uids: number[]) {
        const newEntities = [];

        const averagePosition = new Vector();

        // First, create a copy
        for (let i = 0; i < uids.length; ++i) {
            const entity = root.entityMgr.findByUid(uids[i]);
            assert(entity, "Entity for blueprint not found:" + uids[i]);

            const clone = entity.clone();
            newEntities.push(clone);

            const pos = entity.components.StaticMapEntity.getTileSpaceBounds().getCenter();
            averagePosition.addInplace(pos);
        }

        averagePosition.divideScalarInplace(uids.length);
        const blueprintOrigin = averagePosition.subScalars(0.5, 0.5).floor();

        for (let i = 0; i < uids.length; ++i) {
            newEntities[i].components.StaticMapEntity.origin.subInplace(blueprintOrigin);
        }

        // Now, make sure the origin is 0,0
        return new Blueprint(newEntities);
    }

    /**
     * Rebuilds a blueprint from entities serialized by {@link serializeEntities}
     * (the blueprint library's storage format) - entities come back detached,
     * the same way fromUids's clones are, not registered on any map/entityMgr.
     */
    static fromSerializedEntities(root: GameRoot, payload: unknown[]): Blueprint {
        const entities = payload.map(entry => buildEntityFromSerialized(root, entry as Entity));
        return new Blueprint(entities);
    }

    /**
     * Serializes this blueprint's entities for persistent storage (the
     * blueprint library) - the same per-entity format savegames use.
     */
    serializeEntities() {
        return this.entities.map(entity => entity.serialize());
    }

    get entityCount() {
        return this.entities.length;
    }

    /**
     * Buildings/variants in this blueprint the player hasn't unlocked yet.
     * Placing such a blueprint would place content the player has no
     * business having yet - used to keep a stored blueprint's EQUIP action
     * disabled and to warn before that happens.
     */
    getLockedEntities(root: GameRoot): Entity[] {
        return this.entities.filter(entity => {
            const staticComp = entity.components.StaticMapEntity;
            const metaBuilding = staticComp.getMetaBuilding();
            if (!metaBuilding.getIsUnlocked(root)) {
                return true;
            }
            return !metaBuilding.getAvailableVariants(root).includes(staticComp.getVariant());
        });
    }

    /**
     * Returns the cost of this blueprint in shapes
     */
    getCost() {
        if (G_IS_DEV && globalConfig.debug.blueprintsNoCost) {
            return 0;
        }
        return findNiceIntegerValue(4 * Math.pow(this.entities.length, 1.1));
    }

    /**
     * Returns whether the placement of this blueprint should not consume any
     * shapes.
     *
     * Factors include:
     *  - Game mode permitting free blueprint paste
     *  - The blueprint having {@link isNextPasteFree} flag set
     *  - Cost returned by {@link getCost} being zero
     */
    getIsEffectivelyFree(root: GameRoot) {
        return root.gameMode.getHasFreeCopyPaste() || this.isNextPasteFree || this.getCost() === 0;
    }

    /**
     * Draws the blueprint at the given origin
     */
    draw(parameters: DrawParameters, tile: Vector) {
        parameters.context.globalAlpha = 0.8;
        for (let i = 0; i < this.entities.length; ++i) {
            const entity = this.entities[i];
            const staticComp = entity.components.StaticMapEntity;
            const newPos = staticComp.origin.add(tile);

            const rect = staticComp.getTileSpaceBounds();
            rect.moveBy(tile.x, tile.y);

            if (!parameters.root.logic.checkCanPlaceEntity(entity, { offset: tile })) {
                parameters.context.globalAlpha = 0.3;
            } else {
                parameters.context.globalAlpha = 1;
            }

            staticComp.drawSpriteOnBoundsClipped(
                parameters,
                staticComp.getBlueprintSprite(),
                0,
                newPos,
                true
            );
        }
        parameters.context.globalAlpha = 1;
    }

    /**
     * Rotates the blueprint clockwise
     */
    rotateCw() {
        for (let i = 0; i < this.entities.length; ++i) {
            const entity = this.entities[i];
            const staticComp = entity.components.StaticMapEntity;

            // Actually keeping this in as an easter egg to rotate the trash can
            // if (staticComp.getMetaBuilding().getIsRotateable()) {
            staticComp.rotation = (staticComp.rotation + 90) % 360;
            staticComp.originalRotation = (staticComp.originalRotation + 90) % 360;
            // }

            staticComp.origin = staticComp.origin.rotateFastMultipleOf90(90);
        }
    }

    /**
     * Rotates the blueprint counter clock wise
     */
    rotateCcw() {
        // Well ...
        for (let i = 0; i < 3; ++i) {
            this.rotateCw();
        }
    }

    /**
     * Checks if the blueprint can be placed at the given tile
     * @param {GameRoot} root
     * @param {Vector} tile
     */
    canPlace(root: GameRoot, tile: Vector) {
        let anyPlaceable = false;

        for (let i = 0; i < this.entities.length; ++i) {
            const entity = this.entities[i];
            if (root.logic.checkCanPlaceEntity(entity, { offset: tile })) {
                anyPlaceable = true;
            }
        }

        return anyPlaceable;
    }

    canAfford(root: GameRoot) {
        if (this.getIsEffectivelyFree(root)) {
            return true;
        }

        // Blueprint cost is paid in the account-wide currency (see
        // getBlueprintShapeKey - it's the same shape as the Shop's
        // currency), not a per-save shape balance. Currency shapes never
        // enter storedShapes (see hub_goals.js's handleDefinitionDelivered),
        // so this must check the wallet, not getShapesStoredByKey.
        return root.app.wallet.canSpend(this.getCost());
    }

    /**
     * Attempts to place the blueprint at the given tile
     */
    tryPlace(root: GameRoot, tile: Vector) {
        let placedCount = 0;
        const consumed: boolean = root.logic.performBulkOperation(() => {
            return root.logic.performImmutableOperation(() => {
                let count = 0;
                for (let i = 0; i < this.entities.length; ++i) {
                    const entity = this.entities[i];
                    if (!root.logic.checkCanPlaceEntity(entity, { offset: tile })) {
                        continue;
                    }

                    const clone = entity.clone();
                    clone.components.StaticMapEntity.origin.addInplace(tile);
                    root.logic.freeEntityAreaBeforeBuild(clone);
                    root.map.placeStaticEntity(clone);
                    root.entityMgr.registerEntity(clone);
                    root.actionHistory.noteEntityPlaced(clone);
                    count++;
                }

                placedCount = count;
                return count !== 0;
            });
        });

        if (consumed) {
            if (!this.getIsEffectivelyFree(root)) {
                root.app.wallet.debit(this.getCost());
            }

            this.isNextPasteFree = false;
            root.signals.blueprintPlaced.dispatch(placedCount);
        }

        return consumed;
    }
}
