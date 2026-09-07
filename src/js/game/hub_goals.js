import { globalConfig } from "../core/config";
import { RandomNumberGenerator } from "../core/rng";
import { clamp } from "../core/utils";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { enumColors } from "./colors";
import { enumItemProcessorTypes } from "./components/item_processor";
import { enumAnalyticsDataSource } from "./production_analytics";
import { GameRoot } from "./root";
import { enumSubShape, ShapeDefinition } from "./shape_definition";
import { enumHubGoalRewards } from "./tutorial_goals";

export const MOD_ITEM_PROCESSOR_SPEEDS = {};

/**
 * Which story reward has to be gained to unlock purchasing research of a given tier.
 * @type {Object<number, string>}
 */
export const RESEARCH_TIER_UNLOCK_REWARDS = {
    1: enumHubGoalRewards.reward_research,
    2: enumHubGoalRewards.reward_research_t2,
};

// Shop daily bonus amount - a free once-a-day currency claim, account-wide
// (see WalletStorage, which owns the once-a-day timing) independent of
// ads/IAP so it works before either exists.
const DAILY_BONUS_AMOUNT = 1000;

// Rewarded-ad currency claim amount - Yandex doesn't rate-limit rewarded
// video itself, so the cooldown (see WalletStorage) is entirely our own.
const AD_REWARD_AMOUNT = 250;

// Shape Exchange - a purchasable Shop feature, rate-limited to a handful of
// buy/sell operations per real-world day (raisable with a repeatable
// purchase, capped after a few raises).
const EXCHANGE_LIMIT_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;
const EXCHANGE_LIMIT_BASE = 3;
const EXCHANGE_LIMIT_UPGRADE_AMOUNT = 3;
const EXCHANGE_LIMIT_MAX_UPGRADES = 3;
const EXCHANGE_LIMIT_UPGRADE_PRICE = 5000;

export class HubGoals extends BasicSerializableObject {
    static getId() {
        return "HubGoals";
    }

    static getSchema() {
        return {
            level: types.uint,
            storedShapes: types.keyValueMap(types.uint),
            upgradeLevels: types.keyValueMap(types.uint),
            gainedRewards: types.set(types.string),
            exchangeLimitUpgrades: types.uint,
            exchangeOperationsRemaining: types.uint,
            exchangeLimitResetAt: types.uint,
        };
    }

    /**
     *
     * @param {*} data
     * @param {GameRoot} root
     */
    deserialize(data, root) {
        const errorCode = super.deserialize(data);
        if (errorCode) {
            return errorCode;
        }

        const levels = root.gameMode.getLevelDefinitions();

        // If freeplay is not available, clamp the level
        if (!root.gameMode.getIsFreeplayAvailable()) {
            this.level = Math.min(this.level, levels.length);
        }

        // Remove rewards that no longer exist
        for (const reward of this.gainedRewards) {
            if (!enumHubGoalRewards[reward]) {
                this.gainedRewards.delete(reward);
            }
        }

        // Backfill rewards for levels already completed in this save. Levels
        // can get their reward reassigned between versions (e.g. a level that
        // used to grant a building variant directly now grants
        // reward_research instead) - saves that cleared those levels before
        // the change need the new reward too, without redoing the level.
        for (let i = 0; i < this.level - 1 && i < levels.length; ++i) {
            this.gainedRewards.add(levels[i].reward);
        }

        // Compute upgrade improvements
        const upgrades = this.root.gameMode.getUpgrades();
        for (const upgradeId in upgrades) {
            const tiers = upgrades[upgradeId];
            const level = this.upgradeLevels[upgradeId] || 0;
            let totalImprovement = 1;
            for (let i = 0; i < level; ++i) {
                totalImprovement += tiers[i].improvement;
            }
            this.upgradeImprovements[upgradeId] = totalImprovement;
        }

        // Compute current goal
        this.computeNextGoal();
    }

    /**
     * @param {GameRoot} root
     */
    constructor(root) {
        super();

        this.root = root;

        this.level = 1;

        /**
         * Which story rewards we already gained
         * @type {Set<string>}
         */
        this.gainedRewards = new Set();

        /**
         * Mapping from shape hash -> amount
         * @type {Object<string, number>}
         */
        this.storedShapes = {};

        /**
         * How many times the Shape Exchange's daily-limit upgrade was
         * bought, capped at EXCHANGE_LIMIT_MAX_UPGRADES.
         * @type {number}
         */
        this.exchangeLimitUpgrades = 0;

        /**
         * How many Exchange buy/sell operations are left for the current
         * real-world day - see refreshExchangeLimit()/getExchangeOperationsRemaining().
         * @type {number}
         */
        this.exchangeOperationsRemaining = EXCHANGE_LIMIT_BASE;

        /**
         * Wall-clock timestamp (ms) of the last Exchange daily-limit refill.
         * @type {number}
         */
        this.exchangeLimitResetAt = 0;

        /**
         * Stores the levels for all upgrades
         * @type {Object<string, number>}
         */
        this.upgradeLevels = {};

        /**
         * Stores the improvements for all upgrades
         * @type {Object<string, number>}
         */
        this.upgradeImprovements = {};

        /**
         * Lazily resolved, see getCurrencyShapeDefinition()
         * @type {ShapeDefinition?}
         */
        this.cachedCurrencyShapeDefinition = null;

        // Reset levels first
        const upgrades = this.root.gameMode.getUpgrades();
        for (const key in upgrades) {
            this.upgradeLevels[key] = 0;
            this.upgradeImprovements[key] = 1;
        }

        this.computeNextGoal();

        // Allow quickly switching goals in dev mode
        if (G_IS_DEV) {
            window.addEventListener("keydown", ev => {
                if (ev.key === "p") {
                    // root is not guaranteed to exist within ~0.5s after loading in
                    if (this.root) {
                        if (!this.isEndOfDemoReached()) {
                            this.onGoalCompleted();
                        }
                    }
                }
            });
        }
    }

    /**
     * Returns whether the end of the demo is reached
     * @returns {boolean}
     */
    isEndOfDemoReached() {
        return (
            !this.root.gameMode.getIsFreeplayAvailable() &&
            this.level >= this.root.gameMode.getLevelDefinitions().length
        );
    }

    /**
     * Returns how much of the current shape is stored
     * @param {ShapeDefinition} definition
     * @returns {number}
     */
    getShapesStored(definition) {
        return this.storedShapes[definition.getHash()] || 0;
    }

    /**
     * @param {string} key
     * @param {number} amount
     */
    takeShapeByKey(key, amount) {
        assert(this.getShapesStoredByKey(key) >= amount, "Can not afford: " + key + " x " + amount);
        assert(amount >= 0, "Amount < 0 for " + key);
        assert(Number.isInteger(amount), "Invalid amount: " + amount);
        this.storedShapes[key] = (this.storedShapes[key] || 0) - amount;
        return;
    }

    /**
     * Returns how much of the current shape is stored
     * @param {string} key
     * @returns {number}
     */
    getShapesStoredByKey(key) {
        return this.storedShapes[key] || 0;
    }

    /**
     * Returns how much of the current goal was already delivered
     */
    getCurrentGoalDelivered() {
        if (this.currentGoal.throughputOnly) {
            return (
                this.root.productionAnalytics.getCurrentShapeRateRaw(
                    enumAnalyticsDataSource.delivered,
                    this.currentGoal.definition
                ) / globalConfig.analyticsSliceDurationSeconds
            );
        }

        return this.getShapesStored(this.currentGoal.definition);
    }

    /**
     * Returns the current level of a given upgrade
     * @param {string} upgradeId
     */
    getUpgradeLevel(upgradeId) {
        return this.upgradeLevels[upgradeId] || 0;
    }

    /**
     * Returns whether the given reward is already unlocked
     * @param {enumHubGoalRewards} reward
     */
    isRewardUnlocked(reward) {
        if (G_IS_DEV && globalConfig.debug.allBuildingsUnlocked) {
            return true;
        }

        if (this.root.gameMode.getLevelDefinitions().length < 1) {
            // no story, so always unlocked
            return true;
        }
        return this.gainedRewards.has(reward);
    }

    /**
     * Handles the given definition, by either accounting it towards the
     * goal or otherwise granting some points
     * @param {ShapeDefinition} definition
     */
    handleDefinitionDelivered(definition) {
        const hash = definition.getHash();
        const currencyDefinition = this.getCurrencyShapeDefinition();

        if (currencyDefinition && hash === currencyDefinition.getHash()) {
            // Currency shapes never enter storedShapes (so they can't be
            // spent/exchanged as a per-save balance) - delivering one just
            // credits the account-wide wallet directly. Still shows up in
            // production stats via the shapeDelivered signal below.
            this.root.app.wallet.credit(1);
        } else {
            this.storedShapes[hash] = (this.storedShapes[hash] || 0) + 1;
        }

        this.root.signals.shapeDelivered.dispatch(definition);

        // Check if we have enough for the next level
        if (
            this.getCurrentGoalDelivered() >= this.currentGoal.required ||
            (G_IS_DEV && globalConfig.debug.rewardsInstant)
        ) {
            if (!this.isEndOfDemoReached()) {
                this.onGoalCompleted();
            }
        }
    }

    /**
     * Creates the next goal
     */
    computeNextGoal() {
        const storyIndex = this.level - 1;
        const levels = this.root.gameMode.getLevelDefinitions();
        if (storyIndex < levels.length) {
            const { shape, required, reward, throughputOnly, currencyBonus } = levels[storyIndex];
            this.currentGoal = {
                /** @type {ShapeDefinition} */
                definition: this.root.shapeDefinitionMgr.getShapeFromShortKey(shape),
                required,
                reward,
                throughputOnly,
                currencyBonus,
            };
            return;
        }

        //Floor Required amount to remove confusion
        const required = Math.min(200, Math.floor(4 + (this.level - 27) * 0.25));
        this.currentGoal = {
            definition: this.computeFreeplayShape(this.level),
            required,
            reward: enumHubGoalRewards.no_reward_freeplay,
            throughputOnly: true,
        };
    }

    /**
     * Called when the level was completed
     */
    onGoalCompleted() {
        const { reward, currencyBonus } = this.currentGoal;
        this.gainedRewards.add(reward);
        if (currencyBonus) {
            this.root.app.wallet.credit(currencyBonus);
        }

        ++this.level;
        this.computeNextGoal();

        this.root.signals.storyGoalCompleted.dispatch(this.level - 1, reward);
    }

    /**
     * Returns whether we are playing in free-play
     */
    isFreePlay() {
        return this.level >= this.root.gameMode.getLevelDefinitions().length;
    }

    /**
     * Returns whether a given upgrade can be unlocked
     * @param {string} upgradeId
     */
    canUnlockUpgrade(upgradeId) {
        const tiers = this.root.gameMode.getUpgrades()[upgradeId];
        const currentLevel = this.getUpgradeLevel(upgradeId);

        if (currentLevel >= tiers.length) {
            // Max level
            return false;
        }

        if (G_IS_DEV && globalConfig.debug.upgradesNoCost) {
            return true;
        }

        const tierData = tiers[currentLevel];

        for (let i = 0; i < tierData.required.length; ++i) {
            const requirement = tierData.required[i];
            if ((this.storedShapes[requirement.shape] || 0) < requirement.amount) {
                return false;
            }
        }
        return true;
    }

    /**
     * Returns the number of available upgrades
     * @returns {number}
     */
    getAvailableUpgradeCount() {
        let count = 0;
        for (const upgradeId in this.root.gameMode.getUpgrades()) {
            if (this.canUnlockUpgrade(upgradeId)) {
                ++count;
            }
        }
        return count;
    }

    /**
     * Tries to unlock the given upgrade
     * @param {string} upgradeId
     * @returns {boolean}
     */
    tryUnlockUpgrade(upgradeId) {
        if (!this.canUnlockUpgrade(upgradeId)) {
            return false;
        }

        const upgradeTiers = this.root.gameMode.getUpgrades()[upgradeId];
        const currentLevel = this.getUpgradeLevel(upgradeId);

        const tierData = upgradeTiers[currentLevel];
        if (!tierData) {
            return false;
        }

        if (G_IS_DEV && globalConfig.debug.upgradesNoCost) {
            // Dont take resources
        } else {
            for (let i = 0; i < tierData.required.length; ++i) {
                const requirement = tierData.required[i];

                // Notice: Don't have to check for hash here
                this.storedShapes[requirement.shape] -= requirement.amount;
            }
        }

        this.upgradeLevels[upgradeId] = (this.upgradeLevels[upgradeId] || 0) + 1;
        this.upgradeImprovements[upgradeId] += tierData.improvement;

        this.root.signals.upgradePurchased.dispatch(upgradeId);

        return true;
    }

    /**
     * Returns whether the given research is already purchased
     * @param {string} researchId
     */
    isResearchCompleted(researchId) {
        const research = this.root.gameMode.getResearch()[researchId];
        return this.isRewardUnlocked(research.reward);
    }

    /**
     * Returns whether the given research tier is unlocked for purchasing yet
     * @param {number} tier
     */
    isResearchTierUnlocked(tier) {
        const unlockReward = RESEARCH_TIER_UNLOCK_REWARDS[tier];
        return !unlockReward || this.isRewardUnlocked(unlockReward);
    }

    /**
     * Returns whether a given research can be unlocked
     * @param {string} researchId
     */
    canUnlockResearch(researchId) {
        const research = this.root.gameMode.getResearch()[researchId];

        if (this.isResearchCompleted(researchId) || !this.isResearchTierUnlocked(research.tier)) {
            return false;
        }

        if (G_IS_DEV && globalConfig.debug.upgradesNoCost) {
            return true;
        }

        for (let i = 0; i < research.required.length; ++i) {
            const requirement = research.required[i];
            if ((this.storedShapes[requirement.shape] || 0) < requirement.amount) {
                return false;
            }
        }
        return true;
    }

    /**
     * Tries to unlock the given research
     * @param {string} researchId
     * @returns {boolean}
     */
    tryUnlockResearch(researchId) {
        if (!this.canUnlockResearch(researchId)) {
            return false;
        }

        const research = this.root.gameMode.getResearch()[researchId];

        if (G_IS_DEV && globalConfig.debug.upgradesNoCost) {
            // Dont take resources
        } else {
            for (let i = 0; i < research.required.length; ++i) {
                const requirement = research.required[i];
                this.storedShapes[requirement.shape] -= requirement.amount;
            }
        }

        this.gainedRewards.add(research.reward);
        this.root.signals.researchPurchased.dispatch(researchId);

        return true;
    }

    /**
     * The shape definition for the Shop's currency (whatever
     * gameMode.getCurrencyShapeCode() names) - cached since it never
     * changes for the lifetime of a game mode instance.
     * @returns {ShapeDefinition?}
     */
    getCurrencyShapeDefinition() {
        const code = this.root.gameMode.getCurrencyShapeCode();
        if (!code) {
            return null;
        }
        if (!this.cachedCurrencyShapeDefinition) {
            this.cachedCurrencyShapeDefinition = this.root.shapeDefinitionMgr.getShapeFromShortKey(code);
        }
        return this.cachedCurrencyShapeDefinition;
    }

    /**
     * Returns how much Shop currency the player has - an account-wide
     * balance (see WalletStorage), not per-save.
     * @returns {number}
     */
    getCurrencyAmount() {
        return this.getCurrencyShapeDefinition() ? this.root.app.wallet.balance : 0;
    }

    /**
     * Grants currency directly (daily/ad bonus, Exchange sells) without
     * going through shape delivery.
     * @param {number} amount
     */
    grantCurrency(amount) {
        if (!this.getCurrencyShapeDefinition()) {
            return;
        }
        this.root.app.wallet.credit(amount);
    }

    /**
     * Whether `definition` is the Shop's currency shape - the Exchange must
     * never buy/sell it as a regular shape (see tryPurchaseShapesWithCurrency/
     * sellShapesForCurrency): currency shapes only ever enter storedShapes
     * through this check failing to hold, so letting the Exchange add one to
     * storedShapes would let it be delivered to the Hub afterward for a
     * second, unearned wallet credit.
     * @param {ShapeDefinition} definition
     * @returns {boolean}
     */
    isCurrencyShape(definition) {
        const currencyDefinition = this.getCurrencyShapeDefinition();
        return Boolean(currencyDefinition) && definition.getHash() === currencyDefinition.getHash();
    }

    /**
     * Returns whether a given Shop item can be purchased
     * @param {string} itemId
     */
    canPurchaseShopItem(itemId) {
        const item = this.root.gameMode.getShopItems()[itemId];
        if (this.isRewardUnlocked(item.reward)) {
            return false;
        }
        // The Shop itself only opens for business at reward_research (see
        // currency_shop.js's isShopUnlocked) - item cards are visible with
        // their price before that (currency_shop.js's itemsSection), but
        // nothing is buyable yet.
        if (!this.isRewardUnlocked(enumHubGoalRewards.reward_research)) {
            return false;
        }
        if (item.minLevel && this.level < item.minLevel) {
            return false;
        }
        // longRoute/autoTunnel/autoMerger/autoSplitter only take effect
        // inside BeltPathPlanner's own bounded-bend search, which itself
        // only runs once autoPath is bought - see ShopItemDefinition's
        // `requires` doc.
        if (item.requires && !this.isRewardUnlocked(item.requires)) {
            return false;
        }
        if (G_IS_DEV && globalConfig.debug.upgradesNoCost) {
            return true;
        }
        return this.root.app.wallet.canSpend(item.price);
    }

    /**
     * Tries to purchase the given Shop item
     * @param {string} itemId
     * @returns {boolean}
     */
    tryPurchaseShopItem(itemId) {
        if (!this.canPurchaseShopItem(itemId)) {
            return false;
        }
        const item = this.root.gameMode.getShopItems()[itemId];
        if (!(G_IS_DEV && globalConfig.debug.upgradesNoCost)) {
            this.root.app.wallet.debit(item.price);
        }
        this.gainedRewards.add(item.reward);
        this.root.signals.shopItemPurchased.dispatch(itemId);
        return true;
    }

    /**
     * Whether the Shape Exchange feature itself was purchased yet.
     * @returns {boolean}
     */
    isExchangeUnlocked() {
        return this.isRewardUnlocked(enumHubGoalRewards.reward_shop_exchange);
    }

    /**
     * The daily Exchange operation limit at the current number of purchased
     * limit upgrades.
     * @returns {number}
     */
    getExchangeLimitMax() {
        return EXCHANGE_LIMIT_BASE + this.exchangeLimitUpgrades * EXCHANGE_LIMIT_UPGRADE_AMOUNT;
    }

    /**
     * Refills the daily Exchange operation count once a real-world day has
     * passed since the last refill - called before every read/consume of
     * exchangeOperationsRemaining so the count is always current.
     */
    refreshExchangeLimit() {
        if (Date.now() - this.exchangeLimitResetAt >= EXCHANGE_LIMIT_RESET_INTERVAL_MS) {
            this.exchangeLimitResetAt = Date.now();
            this.exchangeOperationsRemaining = this.getExchangeLimitMax();
        }
    }

    /**
     * How many Exchange buy/sell operations are left today.
     * @returns {number}
     */
    getExchangeOperationsRemaining() {
        this.refreshExchangeLimit();
        return this.exchangeOperationsRemaining;
    }

    /**
     * Whether an Exchange buy/sell can be performed right now (feature
     * bought and today's limit not yet used up).
     * @returns {boolean}
     */
    canPerformExchangeOperation() {
        return (
            this.isExchangeUnlocked() &&
            this.getExchangeOperationsRemaining() > 0 &&
            this.root.app.wallet.canEarn()
        );
    }

    /** Spends one of today's Exchange operations - call after a successful buy/sell. */
    consumeExchangeOperation() {
        this.refreshExchangeLimit();
        this.exchangeOperationsRemaining = Math.max(0, this.exchangeOperationsRemaining - 1);
    }

    /**
     * Whether the daily-limit upgrade has been bought the max number of
     * times already (no more raises possible, regardless of currency).
     * @returns {boolean}
     */
    isExchangeLimitMaxed() {
        return this.exchangeLimitUpgrades >= EXCHANGE_LIMIT_MAX_UPGRADES;
    }

    /** @returns {number} */
    getExchangeLimitUpgradePrice() {
        return EXCHANGE_LIMIT_UPGRADE_PRICE;
    }

    /**
     * Whether the daily-limit upgrade can be bought right now.
     * @returns {boolean}
     */
    canPurchaseExchangeLimitUpgrade() {
        if (!this.isExchangeUnlocked() || this.isExchangeLimitMaxed()) {
            return false;
        }
        if (G_IS_DEV && globalConfig.debug.upgradesNoCost) {
            return true;
        }
        return this.root.app.wallet.canSpend(EXCHANGE_LIMIT_UPGRADE_PRICE);
    }

    /**
     * Tries to buy one Exchange daily-limit raise
     * @returns {boolean}
     */
    tryPurchaseExchangeLimitUpgrade() {
        if (!this.canPurchaseExchangeLimitUpgrade()) {
            return false;
        }
        if (!(G_IS_DEV && globalConfig.debug.upgradesNoCost)) {
            this.root.app.wallet.debit(EXCHANGE_LIMIT_UPGRADE_PRICE);
        }
        this.refreshExchangeLimit();
        ++this.exchangeLimitUpgrades;
        this.exchangeOperationsRemaining += EXCHANGE_LIMIT_UPGRADE_AMOUNT;
        return true;
    }

    /**
     * Whether any quadrant of any layer of the shape has an actual color
     * applied (as opposed to enumColors.uncolored) - painted shapes trade
     * for more than plain ones at the same layer count.
     * @param {ShapeDefinition} definition
     * @returns {boolean}
     */
    isShapeColored(definition) {
        for (const layer of definition.layers) {
            for (const quadrant of layer) {
                if (quadrant && quadrant.color !== enumColors.uncolored) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Currency cost to buy a single shape of the given layer count/color -
     * 2 currency per layer, +1 more if painted (1-layer plain: 2, painted:
     * 3; 2-layer plain: 4, painted: 5; 3-layer plain: 6, painted: 7; ...).
     * Always a whole number, so buying has no minimum-amount step.
     * @param {number} layers
     * @param {boolean} colored
     * @returns {number}
     */
    getShapeBuyCostPerUnit(layers, colored) {
        return 2 * layers + (colored ? 1 : 0);
    }

    /**
     * The smallest valid shape-amount increment for a sell exchange of the
     * given layer count/color - the payout isn't whole-number currency per
     * shape below this. Buying has no such minimum (getShapeBuyCostPerUnit
     * is always a whole currency amount), so this only matters for
     * direction "sell"; kept as a function of direction anyway so callers
     * (the amount-stepper, the "must be a multiple of N" input rule) don't
     * need to special-case which direction they're in.
     * @param {number} layers
     * @param {boolean} colored
     * @param {"buy"|"sell"} direction
     * @returns {number}
     */
    getShapeAmountStep(layers, colored, direction) {
        if (direction === "sell") {
            // Shapes needed for 1 currency: starts at 8 (1-layer plain) and
            // drops by 2 per extra layer, 1 more for paint - floored at 1
            // (1-layer painted 4-layer+ shapes and beyond never go below a
            // 1:1 exchange).
            return Math.max(1, 10 - 2 * layers - (colored ? 1 : 0));
        }
        return 1;
    }

    /**
     * How many currency units it costs to buy `amount` shapes of the given
     * layer count/color.
     * @param {number} layers
     * @param {boolean} colored
     * @param {number} amount
     * @returns {number}
     */
    getShapePurchaseCost(layers, colored, amount) {
        return amount * this.getShapeBuyCostPerUnit(layers, colored);
    }

    /**
     * Tries to buy `amount` of the shape `shapeCode` with currency
     * @param {string} shapeCode
     * @param {number} amount
     * @returns {boolean}
     */
    tryPurchaseShapesWithCurrency(shapeCode, amount) {
        if (!this.canPerformExchangeOperation()) {
            return false;
        }
        if (!ShapeDefinition.isValidShortKey(shapeCode) || amount <= 0) {
            return false;
        }
        const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(shapeCode);
        if (this.isCurrencyShape(definition)) {
            return false;
        }
        const cost = this.getShapePurchaseCost(
            definition.layers.length,
            this.isShapeColored(definition),
            amount
        );
        if (!this.root.app.wallet.canSpend(cost)) {
            return false;
        }
        this.root.app.wallet.debit(cost);
        const shapeHash = definition.getHash();
        this.storedShapes[shapeHash] = (this.storedShapes[shapeHash] || 0) + amount;
        this.consumeExchangeOperation();
        return true;
    }

    /**
     * How many currency units a `amount`-shape sale of the given layer
     * count/color pays out.
     * @param {number} layers
     * @param {boolean} colored
     * @param {number} amount
     * @returns {number?} null if amount isn't sellable evenly at this layer count/color
     */
    getShapeSellPayout(layers, colored, amount) {
        const step = this.getShapeAmountStep(layers, colored, "sell");
        if (amount % step !== 0) {
            return null;
        }
        return amount / step;
    }

    /**
     * Tries to sell `amount` of the shape `shapeCode` for currency
     * @param {string} shapeCode
     * @param {number} amount
     * @returns {boolean}
     */
    sellShapesForCurrency(shapeCode, amount) {
        if (!this.canPerformExchangeOperation()) {
            return false;
        }
        if (!ShapeDefinition.isValidShortKey(shapeCode) || amount <= 0) {
            return false;
        }
        const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(shapeCode);
        if (this.isCurrencyShape(definition)) {
            return false;
        }
        const payout = this.getShapeSellPayout(
            definition.layers.length,
            this.isShapeColored(definition),
            amount
        );
        const shapeHash = definition.getHash();
        if (payout === null || (this.storedShapes[shapeHash] || 0) < amount) {
            return false;
        }
        this.storedShapes[shapeHash] -= amount;
        this.grantCurrency(payout);
        this.consumeExchangeOperation();
        return true;
    }

    /**
     * Whether the Shop's once-a-day free currency bonus can be claimed
     * right now. Account-wide (see WalletStorage), not per-save.
     * @returns {boolean}
     */
    canClaimDailyBonus() {
        return this.root.app.wallet.canClaimDailyBonus();
    }

    /** @returns {number} */
    getDailyBonusAmount() {
        return DAILY_BONUS_AMOUNT;
    }

    /**
     * Claims the Shop's daily bonus if available
     * @returns {boolean}
     */
    tryClaimDailyBonus() {
        return this.root.app.wallet.tryClaimDailyBonus(DAILY_BONUS_AMOUNT);
    }

    /** @returns {boolean} */
    canClaimAdReward() {
        return this.root.app.wallet.canClaimAdReward();
    }

    /** @returns {number} */
    getAdRewardAmount() {
        return AD_REWARD_AMOUNT;
    }

    /**
     * Seconds left until the next rewarded-ad claim is available, 0 if
     * claimable right now.
     * @returns {number}
     */
    getAdRewardCooldownSeconds() {
        return this.root.app.wallet.getAdRewardCooldownSeconds();
    }

    /**
     * Grants the rewarded-ad currency claim. Call only after the platform
     * has confirmed the ad was actually watched (its onRewarded callback
     * fired) - never speculatively before the ad plays.
     * @returns {boolean}
     */
    grantAdReward() {
        return this.root.app.wallet.grantAdReward(AD_REWARD_AMOUNT);
    }

    /**
     * Picks random colors which are close to each other
     * @param {RandomNumberGenerator} rng
     */
    generateRandomColorSet(rng, allowUncolored = false) {
        const colorWheel = [
            enumColors.red,
            enumColors.yellow,
            enumColors.green,
            enumColors.cyan,
            enumColors.blue,
            enumColors.purple,
            enumColors.red,
            enumColors.yellow,
        ];

        const universalColors = [enumColors.white];
        if (allowUncolored) {
            universalColors.push(enumColors.uncolored);
        }
        const index = rng.nextIntRange(0, colorWheel.length - 2);
        const pickedColors = colorWheel.slice(index, index + 3);
        pickedColors.push(rng.choice(universalColors));
        return pickedColors;
    }

    /**
     * Creates a (seeded) random shape
     * @param {number} level
     * @returns {ShapeDefinition}
     */
    computeFreeplayShape(level) {
        const layerCount = clamp(this.level / 25, 2, 4);

        /** @type {Array<import("./shape_definition").ShapeLayer>} */
        let layers = [];

        const rng = new RandomNumberGenerator(this.root.map.seed + "/" + level);

        const colors = this.generateRandomColorSet(rng, level > 35);

        let pickedSymmetry = null; // pairs of quadrants that must be the same
        let availableShapes = [enumSubShape.rect, enumSubShape.circle, enumSubShape.star];
        if (rng.next() < 0.5) {
            pickedSymmetry = [
                // radial symmetry
                [0, 2],
                [1, 3],
            ];
            availableShapes.push(enumSubShape.windmill); // windmill looks good only in radial symmetry
        } else {
            const symmetries = [
                [
                    // horizontal axis
                    [0, 3],
                    [1, 2],
                ],
                [
                    // vertical axis
                    [0, 1],
                    [2, 3],
                ],
                [
                    // diagonal axis
                    [0, 2],
                    [1],
                    [3],
                ],
                [
                    // other diagonal axis
                    [1, 3],
                    [0],
                    [2],
                ],
            ];
            pickedSymmetry = rng.choice(symmetries);
        }

        const randomColor = () => rng.choice(colors);
        const randomShape = () => rng.choice(availableShapes);

        let anyIsMissingTwo = false;

        for (let i = 0; i < layerCount; ++i) {
            /** @type {import("./shape_definition").ShapeLayer} */
            const layer = [null, null, null, null];

            for (let j = 0; j < pickedSymmetry.length; ++j) {
                const group = pickedSymmetry[j];
                const shape = randomShape();
                const color = randomColor();
                for (let k = 0; k < group.length; ++k) {
                    const quad = group[k];
                    layer[quad] = {
                        subShape: shape,
                        color,
                    };
                }
            }

            // Sometimes they actually are missing *two* ones!
            // Make sure at max only one layer is missing it though, otherwise we could
            // create an uncreateable shape
            if (level > 75 && rng.next() > 0.95 && !anyIsMissingTwo) {
                layer[rng.nextIntRange(0, 4)] = null;
                anyIsMissingTwo = true;
            }

            layers.push(layer);
        }

        const definition = new ShapeDefinition({ layers });
        return this.root.shapeDefinitionMgr.registerOrReturnHandle(definition);
    }

    ////////////// HELPERS

    /**
     * Belt speed
     * @returns {number} items / sec
     */
    getBeltBaseSpeed() {
        if (this.root.gameMode.throughputDoesNotMatter()) {
            return globalConfig.beltSpeedItemsPerSecond * globalConfig.puzzleModeSpeed;
        }
        return globalConfig.beltSpeedItemsPerSecond * this.upgradeImprovements.belt;
    }

    /**
     * Underground belt speed
     * @returns {number} items / sec
     */
    getUndergroundBeltBaseSpeed() {
        if (this.root.gameMode.throughputDoesNotMatter()) {
            return globalConfig.beltSpeedItemsPerSecond * globalConfig.puzzleModeSpeed;
        }
        return globalConfig.beltSpeedItemsPerSecond * this.upgradeImprovements.belt;
    }

    /**
     * Miner speed
     * @returns {number} items / sec
     */
    getMinerBaseSpeed() {
        if (this.root.gameMode.throughputDoesNotMatter()) {
            return globalConfig.minerSpeedItemsPerSecond * globalConfig.puzzleModeSpeed;
        }
        return globalConfig.minerSpeedItemsPerSecond * this.upgradeImprovements.miner;
    }

    /**
     * Processor speed
     * @param {enumItemProcessorTypes} processorType
     * @returns {number} items / sec
     */
    getProcessorBaseSpeed(processorType) {
        if (this.root.gameMode.throughputDoesNotMatter()) {
            return globalConfig.beltSpeedItemsPerSecond * globalConfig.puzzleModeSpeed * 10;
        }

        switch (processorType) {
            case enumItemProcessorTypes.trash:
            case enumItemProcessorTypes.hub:
                return 1e30;
            case enumItemProcessorTypes.balancer:
                return globalConfig.beltSpeedItemsPerSecond * this.upgradeImprovements.belt * 2;
            case enumItemProcessorTypes.reader:
                return globalConfig.beltSpeedItemsPerSecond * this.upgradeImprovements.belt;

            case enumItemProcessorTypes.mixer:
            case enumItemProcessorTypes.painter:
            case enumItemProcessorTypes.painterDouble:
            case enumItemProcessorTypes.painterQuad: {
                assert(
                    globalConfig.buildingSpeeds[processorType],
                    "Processor type has no speed set in globalConfig.buildingSpeeds: " + processorType
                );
                return (
                    globalConfig.beltSpeedItemsPerSecond *
                    this.upgradeImprovements.painting *
                    globalConfig.buildingSpeeds[processorType]
                );
            }

            case enumItemProcessorTypes.cutter:
            case enumItemProcessorTypes.cutterQuad:
            case enumItemProcessorTypes.rotator:
            case enumItemProcessorTypes.rotatorCCW:
            case enumItemProcessorTypes.rotator180:
            case enumItemProcessorTypes.stacker: {
                assert(
                    globalConfig.buildingSpeeds[processorType],
                    "Processor type has no speed set in globalConfig.buildingSpeeds: " + processorType
                );
                return (
                    globalConfig.beltSpeedItemsPerSecond *
                    this.upgradeImprovements.processors *
                    globalConfig.buildingSpeeds[processorType]
                );
            }
            default:
                if (MOD_ITEM_PROCESSOR_SPEEDS[processorType]) {
                    return MOD_ITEM_PROCESSOR_SPEEDS[processorType](this.root);
                }
                assertAlways(false, "invalid processor type: " + processorType);
        }

        return 1 / globalConfig.beltSpeedItemsPerSecond;
    }
}
