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
export const enumStackerVariants = { mirrored: "mirrored" };

export class MetaStackerBuilding extends MetaBuilding {
    constructor() {
        super("stacker");
    }

    static getAllVariantCombinations() {
        return [
            {
                internalId: 14,
                variant: defaultBuildingVariant,
            },
            {
                internalId: 67,
                variant: enumStackerVariants.mirrored,
            },
        ];
    }

    getSilhouetteColor() {
        return "#9fcd7d";
    }

    getDimensions() {
        return new Vector(2, 1);
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        if (root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_shop_building_mirroring)) {
            return [defaultBuildingVariant, enumStackerVariants.mirrored];
        }
        return super.getAvailableVariants(root);
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
        const speed = root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.stacker);
        return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_stacker);
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 2,
                processorType: enumItemProcessorTypes.stacker,
            })
        );

        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(0, 0), direction: enumDirection.top }],
            })
        );
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        filter: "shape",
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.bottom,
                        filter: "shape",
                    },
                ],
            })
        );
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        let ejectorSlots = [{ pos: new Vector(0, 0), direction: enumDirection.top }];
        if (variant === enumStackerVariants.mirrored) {
            ejectorSlots = mirrorSlotsHorizontally(ejectorSlots, 2);
        }
        entity.components.ItemEjector.setSlots(ejectorSlots);
    }
}
