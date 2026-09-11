import { formatItemsPerSecond } from "../../core/utils";
import { enumDirection, mirrorSlotsHorizontally, Vector } from "../../core/vector";
import { T } from "../../translations";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

/** @enum {string} */
export const enumCutterVariants = {
    quad: "quad",
    mirrored: "mirrored",
    quadMirrored: "quad-mirrored",
};

export class MetaCutterBuilding extends MetaBuilding {
    constructor() {
        super("cutter");
    }

    static getAllVariantCombinations() {
        return [
            {
                internalId: 9,
                variant: defaultBuildingVariant,
            },
            {
                internalId: 10,
                variant: enumCutterVariants.quad,
            },
            {
                internalId: 61,
                variant: enumCutterVariants.mirrored,
            },
            {
                internalId: 62,
                variant: enumCutterVariants.quadMirrored,
            },
        ];
    }

    getSilhouetteColor() {
        return "#7dcda2";
    }

    getDimensions(variant) {
        switch (variant) {
            case defaultBuildingVariant:
            case enumCutterVariants.mirrored:
                return new Vector(2, 1);
            case enumCutterVariants.quad:
            case enumCutterVariants.quadMirrored:
                return new Vector(4, 1);
            default:
                assertAlways(false, "Unknown cutter variant: " + variant);
        }
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
        const isQuad = variant === enumCutterVariants.quad || variant === enumCutterVariants.quadMirrored;
        const speed = root.hubGoals.getProcessorBaseSpeed(
            isQuad ? enumItemProcessorTypes.cutterQuad : enumItemProcessorTypes.cutter
        );
        return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = [defaultBuildingVariant];
        if (root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_cutter_quad)) {
            variants.push(enumCutterVariants.quad);
        }
        if (root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_shop_building_mirroring)) {
            variants.push(enumCutterVariants.mirrored);
            if (root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_cutter_quad)) {
                variants.push(enumCutterVariants.quadMirrored);
            }
        }
        return variants;
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_cutter_and_trash);
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.cutter,
            })
        );
        entity.addComponent(new ItemEjectorComponent({}));
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        filter: "shape",
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
            case enumCutterVariants.mirrored: {
                const width = 2;
                let acceptorSlots = [
                    { pos: new Vector(0, 0), direction: enumDirection.bottom, filter: "shape" },
                ];
                let ejectorSlots = [
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(1, 0), direction: enumDirection.top },
                ];
                if (variant === enumCutterVariants.mirrored) {
                    acceptorSlots = mirrorSlotsHorizontally(acceptorSlots, width);
                    ejectorSlots = mirrorSlotsHorizontally(ejectorSlots, width);
                }
                entity.components.ItemAcceptor.setSlots(acceptorSlots);
                entity.components.ItemEjector.setSlots(ejectorSlots);
                entity.components.ItemProcessor.type = enumItemProcessorTypes.cutter;
                break;
            }
            case enumCutterVariants.quad:
            case enumCutterVariants.quadMirrored: {
                const width = 4;
                let acceptorSlots = [
                    { pos: new Vector(0, 0), direction: enumDirection.bottom, filter: "shape" },
                ];
                let ejectorSlots = [
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(1, 0), direction: enumDirection.top },
                    { pos: new Vector(2, 0), direction: enumDirection.top },
                    { pos: new Vector(3, 0), direction: enumDirection.top },
                ];
                if (variant === enumCutterVariants.quadMirrored) {
                    acceptorSlots = mirrorSlotsHorizontally(acceptorSlots, width);
                    ejectorSlots = mirrorSlotsHorizontally(ejectorSlots, width);
                }
                entity.components.ItemAcceptor.setSlots(acceptorSlots);
                entity.components.ItemEjector.setSlots(ejectorSlots);
                entity.components.ItemProcessor.type = enumItemProcessorTypes.cutterQuad;
                break;
            }

            default:
                assertAlways(false, "Unknown cutter variant: " + variant);
        }
    }
}
