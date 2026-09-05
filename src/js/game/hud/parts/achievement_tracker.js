import { globalConfig } from "../../../core/config";
import { T } from "../../../translations";
import { enumAnalyticsDataSource } from "../../production_analytics";
import { BaseHUDPart } from "../base_hud_part";
import { enumNotificationType } from "./notifications";

// Our own (post-rebrand) logo shape - the modern equivalent of "produce the logo"
const LOGO_SHAPE = "RwCu--Wu:----Rw--";
// The original shapez.io logo shape - kept in as a hidden nod to where this game came from
const OLD_LOGO_SHAPE = "RuCw--Cw:----Ru--";
const ROCKET_SHAPE = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw";
const BIRD_SHAPE = "Sr------:--Cg--Cg:Sb--Sb--:--Cw--Cw";
const SCISSORS_SHAPE = "Sr------:--CgCgCg:--Sb----:Cw--CwCw";
const NOT_ROCKET_SHAPE = "CbCuCbCu:SrCrSrCr:CwCwCwCw";
const MS_LOGO_SHAPE = "RgRyRbRr";

// How often the "is the current state past some threshold" checks (playtime,
// throughput, stored shapes, ...) get re-evaluated, in seconds of real time.
const CHECK_INTERVAL_SECONDS = 2;

// Shop currency granted for each achievement unlocked - a small bonus on top
// of producing the currency shape directly.
const ACHIEVEMENT_CURRENCY_REWARD = 50;

/**
 * Tracks achievement progress for the current savegame and unlocks
 * achievements (globally, via app.achievements) as their conditions are met.
 */
export class HUDAchievementTracker extends BaseHUDPart {
    createElements() {}

    initialize() {
        /**
         * Per-savegame progress. Achievement unlock state itself lives in
         * app.achievements (global, forever) - this is only the bookkeeping
         * needed to notice when a condition becomes true.
         */
        this.stats = {
            placedTrash: false,
            placedTunnel: false,
            placedBalancer: false,
            placedDoublePainter: false,
            placedInverseRotator: false,
            placedWires: false,
            destroyedBuilding: false,
            purchasedUpgrade: false,
            purchasedBeltUpgrade: false,
            factoryModifiedSinceLastGoal: false,
            producedNewLogo: false,

            beltsPlacedCount: 0,
            wiresPlacedCount: 0,
            trashedItemsCount: 0,
            storedItemsTotal: 0,
            longestBeltPath: 0,
        };

        this.lastCheckTime = 0;
        this.lastGoalCompletedAt = Date.now();
        this.destroyedInCurrentBulkOp = 0;

        const signals = this.root.signals;
        signals.itemProduced.add(this.onItemProduced, this);
        signals.shapeDelivered.add(this.onShapeDelivered, this);
        signals.itemStored.add(this.onItemStored, this);
        signals.itemsTrashed.add(this.onItemsTrashed, this);
        signals.blueprintPlaced.add(this.onBlueprintPlaced, this);
        signals.entityManuallyPlaced.add(this.onEntityManuallyPlaced, this);
        signals.entityDestroyed.add(this.onEntityDestroyed, this);
        signals.bulkOperationFinished.add(this.onBulkOperationFinished, this);
        signals.storyGoalCompleted.add(this.onStoryGoalCompleted, this);
        signals.upgradePurchased.add(this.onUpgradePurchased, this);
        signals.editModeChanged.add(this.onEditModeChanged, this);
        signals.postLoadHook.add(this.onPostLoadHook, this);
    }

    /**
     * @param {string} id
     */
    unlock(id) {
        if (!this.root.app.achievements.unlock(id)) {
            // Already unlocked before (in this save or an earlier one)
            return;
        }
        this.root.hubGoals.grantCurrency(ACHIEVEMENT_CURRENCY_REWARD);
        const def = T.achievements.list[id];
        this.root.hud.signals.notification.dispatch(
            "🏆 " + (def ? def.name : id),
            enumNotificationType.success
        );
    }

    update() {
        const now = this.root.time.realtimeNow();
        if (now - this.lastCheckTime < CHECK_INTERVAL_SECONDS) {
            return;
        }
        this.lastCheckTime = now;
        this.periodicCheck();
    }

    // -- Periodic (state-based) checks

    periodicCheck() {
        const root = this.root;
        const hubGoals = root.hubGoals;

        const hours = root.time.now() / 3600;
        if (hours >= 1) this.unlock("play1h");
        if (hours >= 10) this.unlock("play10h");
        if (hours >= 20) this.unlock("play20h");

        // The blueprint-cost shape and the Shop's currency are the same
        // shape (see getBlueprintShapeKey) and currency shapes never enter
        // storedShapes - they credit the wallet directly on delivery (see
        // hub_goals.js's handleDefinitionDelivered) - so "stored" here means
        // the wallet balance, same source richBuratino below already uses.
        const blueprintKey = root.gameMode.getBlueprintShapeKey();
        const currencyAmount = hubGoals.getCurrencyAmount();
        if (currencyAmount >= 100000) this.unlock("blueprint100k");
        if (currencyAmount >= 1000000) this.unlock("blueprint1m");

        if (currencyAmount >= 1000000) this.unlock("richBuratino");

        const bpRate = this.currentDeliveryRate(blueprintKey);
        if (bpRate >= 25) this.unlock("throughputBp25");
        if (bpRate >= 50) this.unlock("throughputBp50");

        const logoRate = this.currentDeliveryRate(LOGO_SHAPE);
        if (logoRate >= 25) this.unlock("throughputLogo25");
        if (logoRate >= 50) this.unlock("throughputLogo50");

        const rocketRate = this.currentDeliveryRate(ROCKET_SHAPE);
        if (rocketRate >= 10) this.unlock("throughputRocket10");
        if (rocketRate >= 20) this.unlock("throughputRocket20");

        this.checkUpgradeMilestones();
        if (hubGoals.getUpgradeLevel("belt") >= 15) this.unlock("beltsLvl15");

        const uniqueStored = Object.keys(hubGoals.storedShapes).filter(
            key => hubGoals.storedShapes[key] > 0
        ).length;
        if (uniqueStored >= 100) this.unlock("store100Unique");

        const waypoints = root.hud.parts.waypoints;
        if (waypoints && waypoints.waypoints.length >= 15) this.unlock("mapMarkers15");

        if (hubGoals.level > 26) {
            let hasBuildings = false;
            for (const entity of root.entityMgr.entities.values()) {
                if (!entity.components.Hub) {
                    hasBuildings = true;
                    break;
                }
            }
            if (!hasBuildings) this.unlock("noFactoryFreeplay");
        }
    }

    /**
     * @param {string} shapeKey
     */
    currentDeliveryRate(shapeKey) {
        const root = this.root;
        return (
            root.productionAnalytics.getCurrentShapeRateRaw(
                enumAnalyticsDataSource.delivered,
                root.shapeDefinitionMgr.getShapeFromShortKey(shapeKey)
            ) / globalConfig.analyticsSliceDurationSeconds
        );
    }

    checkUpgradeMilestones() {
        const hubGoals = this.root.hubGoals;
        const upgradeIds = Object.keys(this.root.gameMode.getUpgrades());
        const minLevel = Math.min(...upgradeIds.map(id => hubGoals.getUpgradeLevel(id)));
        if (minLevel >= 4) this.unlock("upgradesTier5");
        if (minLevel >= 7) this.unlock("upgradesTier8");
    }

    checkLevelMilestones() {
        const level = this.root.hubGoals.level;
        if (level > 20) this.unlock("unlockWires");
        if (level > 26) this.unlock("completeLvl26");
        if (level > 50) this.unlock("level50");
        if (level > 100) this.unlock("level100");
    }

    updateLongestBeltPath() {
        const beltPaths = this.root.systemMgr.systems.belt.beltPaths;
        let maxLength = this.stats.longestBeltPath;
        for (let i = 0; i < beltPaths.length; ++i) {
            maxLength = Math.max(maxLength, beltPaths[i].entityPath.length);
        }
        this.stats.longestBeltPath = maxLength;
        if (maxLength >= 500) this.unlock("belt500Tiles");
    }

    // -- Event-driven checks

    /**
     * @param {import("../../base_item").BaseItem} item
     */
    onItemProduced(item) {
        if (item.getItemType() !== "shape") {
            return;
        }
        const key = item.definition.getHash();

        switch (key) {
            case BIRD_SHAPE:
                this.unlock("bird");
                break;
            case SCISSORS_SHAPE:
                this.unlock("scissors");
                break;
            case NOT_ROCKET_SHAPE:
                this.unlock("notRocket");
                break;
            case MS_LOGO_SHAPE:
                this.unlock("msLogo");
                break;
            case OLD_LOGO_SHAPE:
                this.unlock("whoKnows");
                break;
            case LOGO_SHAPE:
                this.unlock("produceLogo");
                if (this.root.hubGoals.level < 18) {
                    this.unlock("logoBefore18");
                }
                this.stats.producedNewLogo = true;
                break;
            case ROCKET_SHAPE:
                if (!this.stats.producedNewLogo) {
                    this.unlock("rocketBeforeLogo");
                }
                this.unlock("produceRocket");
                break;
        }

        if (item.definition.layers.length >= 4) this.unlock("stack4Layers");
        if (item.definition.layers.length >= 5) this.unlock("stack5thLayer");
    }

    /**
     * @param {import("../../shape_definition").ShapeDefinition} definition
     */
    onShapeDelivered(definition) {
        const root = this.root;
        const hash = definition.getHash();

        const levels = root.gameMode.getLevelDefinitions();
        for (let i = 0; i < levels.length; ++i) {
            if (levels[i].shape === hash) {
                return;
            }
        }

        const upgrades = root.gameMode.getUpgrades();
        for (const upgradeId in upgrades) {
            const tiers = upgrades[upgradeId];
            for (let i = 0; i < tiers.length; ++i) {
                const required = tiers[i].required;
                for (let k = 0; k < required.length; ++k) {
                    if (required[k].shape === hash) {
                        return;
                    }
                }
            }
        }

        this.unlock("irrelevantShape");
    }

    /**
     * @param {import("../../base_item").BaseItem} item
     */
    onItemStored(item) {
        if (item.getItemType() !== "shape") {
            return;
        }
        this.unlock("storeShape");
        this.stats.storedItemsTotal++;
        if (this.stats.storedItemsTotal >= 200000) this.unlock("store200k");
    }

    /**
     * @param {number} count
     */
    onItemsTrashed(count) {
        this.stats.trashedItemsCount += count;
        if (this.stats.trashedItemsCount >= 1000) this.unlock("trash1000");
    }

    /**
     * @param {number} count
     */
    onBlueprintPlaced(count) {
        this.unlock("placeBlueprint");
        if (count >= 1000) this.unlock("placeBp1000");
        this.stats.factoryModifiedSinceLastGoal = true;
    }

    /**
     * @param {import("../../entity").Entity} entity
     */
    onEntityManuallyPlaced(entity) {
        const staticComp = entity.components.StaticMapEntity;
        if (!staticComp) {
            return;
        }

        this.stats.factoryModifiedSinceLastGoal = true;

        const id = staticComp.getMetaBuilding().getId();
        const variant = staticComp.getVariant();

        // ponytail: cutShape/paintShape/rotateShape/stackShape are approximated as
        // "placed this building type", not "an item actually got processed by it" -
        // good enough for a flavor achievement, upgrade to a real item_processor
        // hook if that distinction ever matters.
        switch (id) {
            case "trash":
                this.stats.placedTrash = true;
                break;
            case "underground_belt":
                this.stats.placedTunnel = true;
                this.updateLongestBeltPath();
                break;
            case "belt":
                this.stats.beltsPlacedCount++;
                if (this.stats.beltsPlacedCount >= 10000) this.unlock("belts10k");
                this.updateLongestBeltPath();
                break;
            case "wire":
                this.stats.placedWires = true;
                this.stats.wiresPlacedCount++;
                if (this.stats.wiresPlacedCount >= 5000) this.unlock("place5000Wires");
                break;
            case "balancer":
                this.stats.placedBalancer = true;
                break;
            case "painter":
                if (variant === "double") this.stats.placedDoublePainter = true;
                this.unlock("paintShape");
                break;
            case "rotator":
                if (variant === "ccw") this.stats.placedInverseRotator = true;
                this.unlock("rotateShape");
                break;
            case "cutter":
                this.unlock("cutShape");
                break;
            case "stacker":
                this.unlock("stackShape");
                break;
        }
    }

    /**
     * @param {import("../../entity").Entity} entity
     */
    onEntityDestroyed(entity) {
        if (!entity.components.StaticMapEntity) {
            return;
        }
        this.stats.destroyedBuilding = true;
        this.stats.factoryModifiedSinceLastGoal = true;
        this.destroyedInCurrentBulkOp++;
    }

    onBulkOperationFinished() {
        if (this.destroyedInCurrentBulkOp >= 1000) {
            this.unlock("destroy1000");
        }
        this.destroyedInCurrentBulkOp = 0;
    }

    /**
     * @param {number} level The level that was just completed
     */
    onStoryGoalCompleted(level) {
        const root = this.root;

        if (level === 6 && !this.stats.placedBalancer) this.unlock("lvl6NoBalancers");
        if (level === 7 && !this.stats.placedTunnel) this.unlock("lvl7NoTunnels");

        if (level === 12) {
            if (!this.stats.placedTrash) this.unlock("lvl12NoTrash");
            if (!this.stats.purchasedUpgrade) this.unlock("lvl12NoUpgrades");
            if (!this.stats.destroyedBuilding) this.unlock("lvl12NoDestroying");
            if (!this.stats.purchasedBeltUpgrade) this.unlock("noBeltUpgradesUntilBp");
            if (root.time.now() < 1800) this.unlock("speedrunBp30");
            if (root.time.now() < 3600) this.unlock("speedrunBp60");
            if (root.time.now() < 7200) this.unlock("speedrunBp120");
        }

        if (level === 13 && !this.stats.placedInverseRotator) this.unlock("noInverseRotater");

        if (level === 20) {
            if (!this.stats.placedDoublePainter) this.unlock("lvl20NoDoublePainter");
            this.unlock("unlockWires");
        }

        if (level === 26) this.unlock("completeLvl26");
        if (level === 27 && !this.stats.placedWires) this.unlock("lvl27NoWires");
        if (level === 50) this.unlock("level50");
        if (level === 100) this.unlock("level100");

        if (level > 26) {
            const elapsedMs = Date.now() - this.lastGoalCompletedAt;
            if (elapsedMs < 30000) this.unlock("freeplayLevel30s");
            if (elapsedMs < 60000) this.unlock("freeplayLevel60s");
            if (elapsedMs < 120000) this.unlock("freeplayLevel120s");

            if (!this.stats.factoryModifiedSinceLastGoal) this.unlock("mam");
        }

        this.stats.factoryModifiedSinceLastGoal = false;
        this.lastGoalCompletedAt = Date.now();
    }

    /**
     * @param {string} upgradeId
     */
    onUpgradePurchased(upgradeId) {
        this.stats.purchasedUpgrade = true;
        if (upgradeId === "belt") this.stats.purchasedBeltUpgrade = true;
        this.checkUpgradeMilestones();
        if (this.root.hubGoals.getUpgradeLevel("belt") >= 15) this.unlock("beltsLvl15");
    }

    /**
     * @param {import("../../root").Layer} layer
     */
    onEditModeChanged(layer) {
        if (layer === "wires") {
            this.unlock("openWires");
        }
    }

    onPostLoadHook() {
        // Catch up in case this save is already past some of these thresholds
        // (an old save loaded after this feature shipped, sandbox editing, ...)
        this.checkLevelMilestones();
        this.checkUpgradeMilestones();
        if (this.root.hubGoals.getUpgradeLevel("belt") >= 15) this.unlock("beltsLvl15");
        if (this.root.app.settings.getAllSettings().theme === "dark") {
            this.unlock("darkMode");
        }
    }

    // -- Persistence (per-savegame progress only, not the unlock state itself)

    serialize() {
        return this.stats;
    }

    /**
     * @param {object} data
     */
    deserialize(data) {
        if (!data || typeof data !== "object") {
            return "Invalid achievement tracker data";
        }
        Object.assign(this.stats, data);
    }
}
