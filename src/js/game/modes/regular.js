/* typehints:start */
import { GameRoot } from "../root";
/* typehints:end */

import { IS_MOBILE } from "../../core/config";
import { findNiceIntegerValue } from "../../core/utils";
import { MOD_SIGNALS } from "../../mods/mod_signals";
import { enumGameModeIds, enumGameModeTypes, GameMode } from "../game_mode";
import { HUDAchievementTracker } from "../hud/parts/achievement_tracker";
import { HUDConstantSignalEdit } from "../hud/parts/constant_signal_edit";
import { HUDCurrencyShop } from "../hud/parts/currency_shop";
import { HUDGameMenu } from "../hud/parts/game_menu";
import { HUDInteractiveTutorial } from "../hud/parts/interactive_tutorial";
import { HUDKeybindingOverlay } from "../hud/parts/keybinding_overlay";
import { HUDLayerPreview } from "../hud/parts/layer_preview";
import { HUDLeverToggle } from "../hud/parts/lever_toggle";
import { HUDMassSelector } from "../hud/parts/mass_selector";
import { HUDMinerHighlight } from "../hud/parts/miner_highlight";
import { HUDMobileControls } from "../hud/parts/mobile_controls";
import { HUDNotifications } from "../hud/parts/notifications";
import { HUDPinnedShapes } from "../hud/parts/pinned_shapes";
import { HUDScreenshotExporter } from "../hud/parts/screenshot_exporter";
import { HUDShapeExchangeList } from "../hud/parts/shape_exchange_list";
import { HUDShapeExchangeModal } from "../hud/parts/shape_exchange_modal";
import { HUDShapeExchangeRates } from "../hud/parts/shape_exchange_rates";
import { HUDShapeViewer } from "../hud/parts/shape_viewer";
import { HUDShop } from "../hud/parts/shop";
import { HUDStatistics } from "../hud/parts/statistics";
import { HUDPartTutorialHints } from "../hud/parts/tutorial_hints";
import { HUDTutorialVideoOffer } from "../hud/parts/tutorial_video_offer";
import { HUDUnlockNotification } from "../hud/parts/unlock_notification";
import { HUDWaypoints } from "../hud/parts/waypoints";
import { HUDWireInfo } from "../hud/parts/wire_info";
import { HUDWiresOverlay } from "../hud/parts/wires_overlay";
import { HUDWiresToolbar } from "../hud/parts/wires_toolbar";
import { ShapeDefinition } from "../shape_definition";
import { enumHubGoalRewards } from "../tutorial_goals";
import { finalGameShape, REGULAR_MODE_LEVELS } from "./levels";

/** @typedef {{
 *   shape: string,
 *   amount: number
 * }} UpgradeRequirement */

/** @typedef {{
 *   required: Array<UpgradeRequirement>
 *   improvement?: number,
 *   excludePrevious?: boolean
 * }} TierRequirement */

/** @typedef {Array<TierRequirement>} UpgradeTiers */

/** @typedef {{
 *   shape: string,
 *   required: number,
 *   reward: enumHubGoalRewards,
 *   throughputOnly?: boolean
 * }} LevelDefinition */

/** @typedef {{
 *   tier: number,
 *   reward: enumHubGoalRewards,
 *   required: Array<UpgradeRequirement>
 * }} ResearchDefinition */

/** @typedef {{
 *   reward: enumHubGoalRewards,
 *   price: number
 * }} ShopItemDefinition */

export const rocketShape = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw";
const preparementShape = "CpRpCp--:SwSwSwSw";

// Tiers need % of the previous tier as requirement too
const tierGrowth = 2.5;

// TODO: Convert this file to TS and fix types. Maybe split the levels and upgrades as well
let upgradesCache = null;

/**
 * Generates all upgrades
 * @returns {Object<string, UpgradeTiers>}
 */
function generateUpgrades() {
    if (upgradesCache) {
        return upgradesCache;
    }

    const fixedImprovements = [0.5, 0.5, 1, 1, 2, 1, 1];
    const numEndgameUpgrades = 1000 - fixedImprovements.length - 1;

    function generateInfiniteUnlocks() {
        return new Array(numEndgameUpgrades).fill(null).map((_, i) => ({
            required: [
                { shape: preparementShape, amount: 30000 + i * 10000 },
                { shape: finalGameShape, amount: 20000 + i * 5000 },
                { shape: rocketShape, amount: 20000 + i * 5000 },
            ],
            excludePrevious: true,
        }));
    }

    // Fill in endgame upgrades
    for (let i = 0; i < numEndgameUpgrades; ++i) {
        if (i < 20) {
            fixedImprovements.push(0.1);
        } else if (i < 50) {
            fixedImprovements.push(0.05);
        } else if (i < 100) {
            fixedImprovements.push(0.025);
        } else {
            fixedImprovements.push(0.0125);
        }
    }

    const upgrades = {
        belt: [
            {
                required: [{ shape: "CuCuCuCu", amount: 30 }],
            },
            {
                required: [{ shape: "--CuCu--", amount: 500 }],
            },
            {
                required: [{ shape: "CpCpCpCp", amount: 1000 }],
            },
            {
                required: [{ shape: "SrSrSrSr:CyCyCyCy", amount: 6000 }],
            },
            {
                required: [{ shape: "SrSrSrSr:CyCyCyCy:SwSwSwSw", amount: 25000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        miner: [
            {
                required: [{ shape: "RuRuRuRu", amount: 300 }],
            },
            {
                required: [{ shape: "Cu------", amount: 800 }],
            },
            {
                required: [{ shape: "ScScScSc", amount: 3500 }],
            },
            {
                required: [{ shape: "CwCwCwCw:WbWbWbWb", amount: 23000 }],
            },
            {
                required: [
                    {
                        shape: "CbRbRbCb:CwCwCwCw:WbWbWbWb",
                        amount: 50000,
                    },
                ],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        processors: [
            {
                required: [{ shape: "SuSuSuSu", amount: 500 }],
            },
            {
                required: [{ shape: "RuRu----", amount: 600 }],
            },
            {
                required: [{ shape: "CgScScCg", amount: 3500 }],
            },
            {
                required: [{ shape: "CwCrCwCr:SgSgSgSg", amount: 25000 }],
            },
            {
                required: [{ shape: "WrRgWrRg:CwCrCwCr:SgSgSgSg", amount: 50000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        painting: [
            {
                required: [{ shape: "RbRb----", amount: 600 }],
            },
            {
                required: [{ shape: "WrWrWrWr", amount: 3800 }],
            },
            {
                required: [
                    {
                        shape: "RpRpRpRp:CwCwCwCw",
                        amount: 6500,
                    },
                ],
            },
            {
                required: [{ shape: "WpWpWpWp:CwCwCwCw:WpWpWpWp", amount: 25000 }],
            },
            {
                required: [{ shape: "WpWpWpWp:CwCwCwCw:WpWpWpWp:CwCwCwCw", amount: 50000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],
    };

    // Automatically generate tier levels
    for (const upgradeId in upgrades) {
        const upgradeTiers = upgrades[upgradeId];

        let currentTierRequirements = [];
        for (let i = 0; i < upgradeTiers.length; ++i) {
            const tierHandle = upgradeTiers[i];
            tierHandle.improvement = fixedImprovements[i];

            const originalRequired = tierHandle.required.slice();

            for (let k = currentTierRequirements.length - 1; k >= 0; --k) {
                const oldTierRequirement = currentTierRequirements[k];
                if (!tierHandle.excludePrevious) {
                    tierHandle.required.unshift({
                        shape: oldTierRequirement.shape,
                        amount: oldTierRequirement.amount,
                    });
                }
            }
            currentTierRequirements.push(
                ...originalRequired.map(req => ({
                    amount: req.amount,
                    shape: req.shape,
                }))
            );
            currentTierRequirements.forEach(tier => {
                tier.amount = findNiceIntegerValue(tier.amount * tierGrowth);
            });
        }
    }

    MOD_SIGNALS.modifyUpgrades.dispatch(upgrades);

    // VALIDATE
    if (G_IS_DEV) {
        for (const upgradeId in upgrades) {
            upgrades[upgradeId].forEach(tier => {
                tier.required.forEach(({ shape }) => {
                    try {
                        ShapeDefinition.fromShortKey(shape);
                    } catch (ex) {
                        throw new Error("Invalid upgrade goal for shape " + shape, { cause: ex });
                    }
                });
            });
        }
    }

    upgradesCache = upgrades;
    return upgrades;
}

let levelDefinitionsCache = null;

/**
 * Generates the level definitions
 */
export function generateLevelDefinitions() {
    // NOTE: This cache is useless in production, but is there because of the G_IS_DEV validation
    if (levelDefinitionsCache) {
        return levelDefinitionsCache;
    }

    const levelDefinitions = REGULAR_MODE_LEVELS;
    MOD_SIGNALS.modifyLevelDefinitions.dispatch(levelDefinitions);

    if (G_IS_DEV) {
        levelDefinitions.forEach(({ shape }) => {
            try {
                ShapeDefinition.fromShortKey(shape);
            } catch (ex) {
                throw new Error("Invalid tutorial goal for shape " + shape, { cause: ex });
            }
        });
    }

    levelDefinitionsCache = levelDefinitions;
    return levelDefinitions;
}

// Currency shapes are simply the shape of the level that opens each research
// tier (level 9 for tier 1, level 16 for tier 2) - the player is already
// producing it at that point, nothing new to introduce.
const researchTier1Currency = "CpCpCpCp";
const researchTier2Currency = "SrSrSrSr:CyCyCyCy:SwSwSwSw";

let researchCache = null;

/**
 * Generates the research definitions - building variants that used to be
 * handed out directly by the level ladder, now bought with shapes instead.
 * @returns {Object<string, ResearchDefinition>}
 */
function generateResearch() {
    if (researchCache) {
        return researchCache;
    }

    const research = {
        rotatorCcw: {
            tier: 1,
            reward: enumHubGoalRewards.reward_rotator_ccw,
            required: [
                { shape: researchTier1Currency, amount: 2400 },
                { shape: "CrCrCrCr", amount: 30 },
            ],
        },
        balancerMerger: {
            tier: 1,
            reward: enumHubGoalRewards.reward_merger,
            // Merger used to be granted by the same level that now sells the
            // tier-1 currency shape, so its "own" shape and the currency
            // shape are the same one - just fold both amounts together.
            required: [{ shape: researchTier1Currency, amount: 2430 }],
        },
        minerChainable: {
            tier: 1,
            reward: enumHubGoalRewards.reward_miner_chainable,
            required: [
                { shape: researchTier1Currency, amount: 2400 },
                { shape: "CgScScCg", amount: 30 },
            ],
        },
        cutterQuad: {
            tier: 1,
            reward: enumHubGoalRewards.reward_cutter_quad,
            required: [
                { shape: researchTier1Currency, amount: 2400 },
                { shape: "SrSrSrSr:CyCyCyCy:SwSwSwSw", amount: 30 },
            ],
        },

        undergroundBeltTier2: {
            tier: 2,
            reward: enumHubGoalRewards.reward_underground_belt_tier_2,
            required: [
                { shape: researchTier2Currency, amount: 24000 },
                { shape: "RpRpRpRp:CwCwCwCw", amount: 30 },
            ],
        },
        painterDouble: {
            tier: 2,
            reward: enumHubGoalRewards.reward_painter_double,
            required: [
                { shape: researchTier2Currency, amount: 24000 },
                { shape: "CbRbRbCb:CwCwCwCw:WbWbWbWb", amount: 30 },
            ],
        },
        rotator180: {
            tier: 2,
            reward: enumHubGoalRewards.reward_rotator_180,
            required: [
                { shape: researchTier2Currency, amount: 24000 },
                { shape: "Sg----Sg:CgCgCgCg:--CyCy--", amount: 30 },
            ],
        },
        balancerSplitter: {
            tier: 2,
            reward: enumHubGoalRewards.reward_splitter,
            required: [
                { shape: researchTier2Currency, amount: 24000 },
                { shape: "CpRpCp--:SwSwSwSw", amount: 30 },
            ],
        },
    };

    if (G_IS_DEV) {
        for (const researchId in research) {
            research[researchId].required.forEach(({ shape }) => {
                try {
                    ShapeDefinition.fromShortKey(shape);
                } catch (ex) {
                    throw new Error("Invalid research requirement for shape " + shape, { cause: ex });
                }
            });
        }
    }

    researchCache = research;
    return research;
}

// The currency shape itself - doesn't tie into any level, purely a Shop
// concept: deliver it to the Hub like any other requested shape (the
// existing storedShapes bookkeeping already counts it, see hub_goals.js)
// or earn it from achievements/ads.
const currencyShapeCode = "CgCgCgCg:RwCu--Wu:----Rw--";

let shopItemsCache = null;

/**
 * Generates the one-off Shop purchases (currency-priced, not shape-priced
 * like research) - unlockable automation behaviors that are on by default
 * in a build with no monetization, off by default here until bought.
 * @returns {Object<string, ShopItemDefinition>}
 */
function generateShopItems() {
    if (shopItemsCache) {
        return shopItemsCache;
    }

    shopItemsCache = {
        autoTunnel: {
            reward: enumHubGoalRewards.reward_shop_auto_tunnel,
            price: 8000,
        },
        longRoute: {
            reward: enumHubGoalRewards.reward_shop_long_route,
            price: 6000,
        },
        overviewBuilding: {
            reward: enumHubGoalRewards.reward_shop_overview_building,
            price: 2000,
        },
        autoMerger: {
            reward: enumHubGoalRewards.reward_shop_auto_merger,
            price: 10000,
        },
        autoSplitter: {
            reward: enumHubGoalRewards.reward_shop_auto_splitter,
            price: 10000,
        },
        // Not rendered as a regular .shopItem card - currency_shop.js skips
        // it there and shows its price/purchase next to the "Exchange"
        // button and inside shape_exchange_list.js instead.
        exchange: {
            reward: enumHubGoalRewards.reward_shop_exchange,
            price: 5000,
        },
    };
    return shopItemsCache;
}

export class RegularGameMode extends GameMode {
    static getId() {
        return enumGameModeIds.regular;
    }

    static getType() {
        return enumGameModeTypes.default;
    }

    /** @param {GameRoot} root */
    constructor(root) {
        super(root);

        this.additionalHudParts = {
            wiresToolbar: HUDWiresToolbar,
            unlockNotification: HUDUnlockNotification,
            massSelector: HUDMassSelector,
            shop: HUDShop,
            currencyShop: HUDCurrencyShop,
            shapeExchangeList: HUDShapeExchangeList,
            shapeExchangeModal: HUDShapeExchangeModal,
            shapeExchangeRates: HUDShapeExchangeRates,
            statistics: HUDStatistics,
            waypoints: HUDWaypoints,
            wireInfo: HUDWireInfo,
            leverToggle: HUDLeverToggle,
            pinnedShapes: HUDPinnedShapes,
            notifications: HUDNotifications,
            screenshotExporter: HUDScreenshotExporter,
            wiresOverlay: HUDWiresOverlay,
            shapeViewer: HUDShapeViewer,
            layerPreview: HUDLayerPreview,
            minerHighlight: HUDMinerHighlight,
            tutorialVideoOffer: HUDTutorialVideoOffer,
            gameMenu: HUDGameMenu,
            constantSignalEdit: HUDConstantSignalEdit,
            achievementTracker: HUDAchievementTracker,
        };

        if (!IS_MOBILE) {
            this.additionalHudParts.keybindingOverlay = HUDKeybindingOverlay;
        } else {
            this.additionalHudParts.mobileControls = HUDMobileControls;
        }

        if (this.root.app.settings.getAllSettings().offerHints) {
            this.additionalHudParts.tutorialHints = HUDPartTutorialHints;
            this.additionalHudParts.interactiveTutorial = HUDInteractiveTutorial;
        }
    }

    /**
     * Should return all available upgrades
     * @returns {Object<string, UpgradeTiers>}
     */
    getUpgrades() {
        return generateUpgrades();
    }

    /**
     * Returns the goals for all levels including their reward
     * @returns {Array<LevelDefinition>}
     */
    getLevelDefinitions() {
        return generateLevelDefinitions();
    }

    /**
     * Should return all available research
     * @returns {Object<string, ResearchDefinition>}
     */
    getResearch() {
        return generateResearch();
    }

    /**
     * Should return all available Shop purchases
     * @returns {Object<string, ShopItemDefinition>}
     */
    getShopItems() {
        return generateShopItems();
    }

    /** @returns {string} */
    getCurrencyShapeCode() {
        return currencyShapeCode;
    }

    /**
     * Should return whether free play is available or if the game stops
     * after the predefined levels
     * @returns {boolean}
     */
    getIsFreeplayAvailable() {
        return true;
    }
}
