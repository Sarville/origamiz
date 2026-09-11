import { formatItemsPerSecond } from "../../core/utils";
import { enumDirection, mirrorSlotsHorizontally, Vector } from "../../core/vector";
import { T } from "../../translations";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import {
    enumItemProcessorTypes,
    ItemProcessorComponent,
    enumItemProcessorRequirements,
} from "../components/item_processor";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { WiredPinsComponent, enumPinSlotType } from "../components/wired_pins";

/**
 * mirrored: color input flips top<->bottom, shape input/output stay put (left/right).
 * flipped: shape input/output flip left<->right (color stays wherever it already was).
 * flipped-mirrored: both flips combined.
 * double/quad only get the shape/output flip - they never had a top/bottom color
 * choice to combine with.
 * @enum {string}
 */
export const enumPainterVariants = {
    mirrored: "mirrored",
    flipped: "flipped",
    flippedMirrored: "flipped-mirrored",
    double: "double",
    doubleFlipped: "double-flipped",
    quad: "quad",
    quadFlipped: "quad-flipped",
};

export class MetaPainterBuilding extends MetaBuilding {
    constructor() {
        super("painter");
    }

    static getAllVariantCombinations() {
        return [
            {
                internalId: 16,
                variant: defaultBuildingVariant,
            },
            {
                internalId: 17,
                variant: enumPainterVariants.mirrored,
            },
            {
                internalId: 18,
                variant: enumPainterVariants.double,
            },
            {
                internalId: 19,
                variant: enumPainterVariants.quad,
            },
            {
                internalId: 63,
                variant: enumPainterVariants.flipped,
            },
            {
                internalId: 64,
                variant: enumPainterVariants.flippedMirrored,
            },
            {
                internalId: 65,
                variant: enumPainterVariants.doubleFlipped,
            },
            {
                internalId: 66,
                variant: enumPainterVariants.quadFlipped,
            },
        ];
    }

    getDimensions(variant) {
        switch (variant) {
            case defaultBuildingVariant:
            case enumPainterVariants.mirrored:
            case enumPainterVariants.flipped:
            case enumPainterVariants.flippedMirrored:
                return new Vector(2, 1);
            case enumPainterVariants.double:
            case enumPainterVariants.doubleFlipped:
                return new Vector(2, 2);
            case enumPainterVariants.quad:
            case enumPainterVariants.quadFlipped:
                return new Vector(4, 1);
            default:
                assertAlways(false, "Unknown painter variant: " + variant);
        }
    }

    getSilhouetteColor() {
        return "#cd9b7d";
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        if (root.gameMode.throughputDoesNotMatter()) {
            return [];
        }
        switch (variant) {
            case defaultBuildingVariant:
            case enumPainterVariants.mirrored:
            case enumPainterVariants.flipped:
            case enumPainterVariants.flippedMirrored: {
                const speed = root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.painter);
                return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
            }
            case enumPainterVariants.double:
            case enumPainterVariants.doubleFlipped: {
                const speed = root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.painterDouble);
                return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed, true)]];
            }
            case enumPainterVariants.quad:
            case enumPainterVariants.quadFlipped: {
                const speed = root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.painterQuad);
                return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
            }
        }
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = [defaultBuildingVariant, enumPainterVariants.mirrored];

        const mirroringUnlocked = root.hubGoals.isRewardUnlocked(
            enumHubGoalRewards.reward_shop_building_mirroring
        );
        if (mirroringUnlocked) {
            variants.push(enumPainterVariants.flipped, enumPainterVariants.flippedMirrored);
        }

        if (root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_painter_double)) {
            variants.push(enumPainterVariants.double);
            if (mirroringUnlocked) {
                variants.push(enumPainterVariants.doubleFlipped);
            }
        }
        if (
            root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_wires_painter_and_levers) &&
            root.gameMode.getSupportsWires()
        ) {
            variants.push(enumPainterVariants.quad);
            if (mirroringUnlocked) {
                variants.push(enumPainterVariants.quadFlipped);
            }
        }
        return variants;
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_painter);
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(new ItemProcessorComponent({}));

        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(1, 0), direction: enumDirection.right }],
            })
        );
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        filter: "shape",
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.top,
                        filter: "color",
                    },
                ],
            })
        );
    }

    /**
     *
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        switch (variant) {
            case defaultBuildingVariant:
            case enumPainterVariants.mirrored:
            case enumPainterVariants.flipped:
            case enumPainterVariants.flippedMirrored: {
                // REGULAR PAINTER

                if (entity.components.WiredPins) {
                    entity.removeComponent(WiredPinsComponent);
                }

                const colorOnBottom =
                    variant === enumPainterVariants.mirrored ||
                    variant === enumPainterVariants.flippedMirrored;
                const flipped =
                    variant === enumPainterVariants.flipped ||
                    variant === enumPainterVariants.flippedMirrored;

                let acceptorSlots = [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        filter: "shape",
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: colorOnBottom ? enumDirection.bottom : enumDirection.top,
                        filter: "color",
                    },
                ];
                let ejectorSlots = [{ pos: new Vector(1, 0), direction: enumDirection.right }];

                if (flipped) {
                    acceptorSlots = mirrorSlotsHorizontally(acceptorSlots, 2);
                    ejectorSlots = mirrorSlotsHorizontally(ejectorSlots, 2);
                }

                entity.components.ItemAcceptor.setSlots(acceptorSlots);
                entity.components.ItemEjector.setSlots(ejectorSlots);

                entity.components.ItemProcessor.type = enumItemProcessorTypes.painter;
                entity.components.ItemProcessor.processingRequirement = null;
                entity.components.ItemProcessor.inputsPerCharge = 2;

                break;
            }

            case enumPainterVariants.double:
            case enumPainterVariants.doubleFlipped: {
                // DOUBLE PAINTER

                if (entity.components.WiredPins) {
                    entity.removeComponent(WiredPinsComponent);
                }

                let acceptorSlots = [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        filter: "shape",
                    },
                    {
                        pos: new Vector(0, 1),
                        direction: enumDirection.left,
                        filter: "shape",
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.top,
                        filter: "color",
                    },
                ];
                let ejectorSlots = [{ pos: new Vector(1, 0), direction: enumDirection.right }];

                if (variant === enumPainterVariants.doubleFlipped) {
                    acceptorSlots = mirrorSlotsHorizontally(acceptorSlots, 2);
                    ejectorSlots = mirrorSlotsHorizontally(ejectorSlots, 2);
                }

                entity.components.ItemAcceptor.setSlots(acceptorSlots);
                entity.components.ItemEjector.setSlots(ejectorSlots);

                entity.components.ItemProcessor.type = enumItemProcessorTypes.painterDouble;
                entity.components.ItemProcessor.processingRequirement = null;
                entity.components.ItemProcessor.inputsPerCharge = 3;
                break;
            }

            case enumPainterVariants.quad:
            case enumPainterVariants.quadFlipped: {
                // QUAD PAINTER

                if (!entity.components.WiredPins) {
                    entity.addComponent(new WiredPinsComponent({ slots: [] }));
                }

                let wiredSlots = [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(2, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(3, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ];

                let acceptorSlots = [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        filter: "shape",
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        filter: "color",
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.bottom,
                        filter: "color",
                    },
                    {
                        pos: new Vector(2, 0),
                        direction: enumDirection.bottom,
                        filter: "color",
                    },
                    {
                        pos: new Vector(3, 0),
                        direction: enumDirection.bottom,
                        filter: "color",
                    },
                ];

                let ejectorSlots = [{ pos: new Vector(0, 0), direction: enumDirection.top }];

                if (variant === enumPainterVariants.quadFlipped) {
                    wiredSlots = mirrorSlotsHorizontally(wiredSlots, 4);
                    acceptorSlots = mirrorSlotsHorizontally(acceptorSlots, 4);
                    ejectorSlots = mirrorSlotsHorizontally(ejectorSlots, 4);
                }

                entity.components.WiredPins.setSlots(wiredSlots);
                entity.components.ItemAcceptor.setSlots(acceptorSlots);
                entity.components.ItemEjector.setSlots(ejectorSlots);

                entity.components.ItemProcessor.type = enumItemProcessorTypes.painterQuad;
                entity.components.ItemProcessor.processingRequirement =
                    enumItemProcessorRequirements.painterQuad;
                entity.components.ItemProcessor.inputsPerCharge = 5;

                break;
            }

            default:
                assertAlways(false, "Unknown painter variant: " + variant);
        }
    }
}
