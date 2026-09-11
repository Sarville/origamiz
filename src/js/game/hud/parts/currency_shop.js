import { formatBigNumber, formatSeconds, makeDiv } from "../../../core/utils";
import { SOUNDS } from "../../../platform/sound";
import { T } from "../../../translations";
import { KEYMAPPINGS, KeyActionMapper } from "../../key_action_mapper";
import { InputReceiver } from "../../../core/input_receiver";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

/**
 * The "Shop" window - separate from the "Upgrades" window (shop.js/HUDShop,
 * an unfortunate pre-existing name clash). Sells one-off automation
 * behaviors, offers a daily free-currency claim, and opens the shape
 * Exchange (shape_exchange_list.js) for converting currency into/from
 * arbitrary shapes. Currency itself has no separate savegame field - it's
 * just however many of gameMode.getCurrencyShapeCode() the player has
 * delivered to the Hub, tracked the same way as any other requested shape
 * (see hub_goals.js).
 */
export class HUDCurrencyShop extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_CurrencyShop", ["ingameDialog"]);

        this.dialogInner = makeDiv(this.background, null, ["dialogInner"]);
        this.title = makeDiv(this.dialogInner, null, ["title"], T.ingame.currencyShop.title);
        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);
        this.contentDiv = makeDiv(this.dialogInner, null, ["content"]);

        // Below reward_research (see isShopUnlocked()), currency has nothing
        // to earn or spend yet - shown instead of the balance/dailyBonus/
        // adReward below, which all revolve around earning or spending it.
        // Remove-ads is real-money, not currency, so it stays outside this
        // gate and is always available. The currency pack is also real-money,
        // but selling currency the player can't spend yet is pointless, so
        // it's hidden until the same level instead (see createCurrencyPackSection).
        // The item cards themselves (itemsSection below) also stay outside
        // this gate: shown with their price from the start so the player can
        // see what's coming, just with no buy button until this same level
        // (see renderCountsAndStatus).
        this.lockedDisclaimerElem = makeDiv(this.contentDiv, null, ["lockedDisclaimer"]);

        // Shown instead of a wallet lock reason from another device - see
        // WalletStorage's class doc on the cross-device session lock.
        this.sessionLockedDisclaimerElem = makeDiv(
            this.contentDiv,
            null,
            ["lockedDisclaimer"],
            T.ingame.currencyShop.sessionLocked
        );

        this.gatedContent = makeDiv(this.contentDiv, null, ["gatedContent"]);

        // Balance header - the currency's own shape icon plus how many the
        // player has, exactly the way requirement amounts are shown
        // elsewhere (shop.js's createRequirementElement) - plus the
        // "Обмен" button, pushed to the row's right edge. Exchange is itself
        // a purchasable Shop feature (see hub_goals.js's reward_shop_exchange),
        // so its price shows next to the button until bought - wrapped
        // together so the pair moves as one unit regardless of whether the
        // price is visible.
        this.balanceElem = makeDiv(this.gatedContent, null, ["currencyBalance"]);
        this.currencyIconHolder = makeDiv(this.balanceElem, null, ["icon"]);
        this.balanceAmountElem = makeDiv(this.balanceElem, null, ["amount"]);

        this.exchangeActionElem = makeDiv(this.balanceElem, null, ["exchangeAction"]);
        this.exchangePriceElem = makeDiv(this.exchangeActionElem, null, ["price"]);
        this.exchangeButton = document.createElement("button");
        this.exchangeButton.classList.add("exchangeButton", "styledButton");
        this.exchangeActionElem.appendChild(this.exchangeButton);
        this.trackClicks(this.exchangeButton, () => this.root.hud.parts.shapeExchangeList.show());

        this.createDailyBonusSection();
        this.createAdRewardSection();
        this.createCurrencyPackSection();
        this.createRemoveAdsSection();

        // One-off toggle purchases - "exchange" is deliberately excluded,
        // its purchase UI lives next to the balance row / inside
        // shape_exchange_list.js instead of a generic card here. Its own
        // section, outside gatedContent, since the cards stay visible (price
        // only, no buy button) even before isShopUnlocked() - see
        // renderCountsAndStatus.
        this.itemsSection = makeDiv(this.contentDiv, null, ["itemsSection"]);
        this.itemsToElements = {};
        const items = this.root.gameMode.getShopItems();
        for (const itemId in items) {
            if (itemId === "exchange") {
                continue;
            }
            const handle = {};

            handle.elem = makeDiv(this.itemsSection, null, ["shopItem"]);
            handle.elem.setAttribute("data-item-id", itemId);

            makeDiv(handle.elem, null, ["title"], T.shopItems[itemId].name);
            makeDiv(handle.elem, null, ["description"], T.shopItems[itemId].description);
            handle.elemPrice = makeDiv(handle.elem, null, ["price"]);

            handle.buyButton = document.createElement("button");
            handle.buyButton.classList.add("buy", "styledButton");
            handle.buyButton.innerText = T.ingame.currencyShop.buttonBuy;
            handle.elem.appendChild(handle.buyButton);
            this.trackClicks(handle.buyButton, () => this.tryPurchaseItem(itemId));

            this.itemsToElements[itemId] = handle;
        }
    }

    /**
     * Currency has nothing to earn or spend until Research (reward_research)
     * unlocks - gates the balance/dailyBonus/adReward/items UI, but not
     * remove-ads (real money, always purchasable).
     */
    isShopUnlocked() {
        return this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_research);
    }

    /**
     * The level number that grants reward_research, for the locked-state
     * disclaimer text - looked up instead of hardcoded so it stays correct
     * if the level list is ever reordered.
     */
    getUnlockLevel() {
        const levels = this.root.gameMode.getLevelDefinitions();
        const index = levels.findIndex(level => level.reward === enumHubGoalRewards.reward_research);
        return index + 1;
    }

    /**
     * The once-a-day free currency claim - real wall-clock time, works
     * before any ad/IAP integration exists (see hub_goals.js).
     */
    createDailyBonusSection() {
        const daily = T.ingame.currencyShop.dailyBonus;
        const container = makeDiv(this.gatedContent, null, ["dailyBonus"]);
        makeDiv(container, null, ["title"], daily.title);
        makeDiv(container, null, ["description"], daily.description);

        this.dailyBonusButton = document.createElement("button");
        this.dailyBonusButton.classList.add("buy", "styledButton");
        container.appendChild(this.dailyBonusButton);
        this.trackClicks(this.dailyBonusButton, () => this.tryClaimDailyBonus());
    }

    /**
     * Rewarded-ad currency claim, on a cooldown (see hub_goals.js's
     * AD_REWARD_INTERVAL_MS) since the platform itself doesn't limit
     * rewarded video calls. Skipped entirely on platforms without ad
     * support (see PlatformWrapperImplBrowser.getSupportsRewardedAds).
     */
    createAdRewardSection() {
        if (!this.root.app.platformWrapper.getSupportsRewardedAds()) {
            return;
        }

        const ad = T.ingame.currencyShop.adReward;
        const container = makeDiv(this.gatedContent, null, ["dailyBonus"]);
        makeDiv(container, null, ["title"], ad.title);
        makeDiv(container, null, ["description"], ad.description);

        this.adRewardButton = document.createElement("button");
        this.adRewardButton.classList.add("buy", "styledButton");
        container.appendChild(this.adRewardButton);
        this.trackClicks(this.adRewardButton, () => this.tryClaimAdReward());
    }

    /**
     * Real-money currency pack purchase (Yandex Payments, consumable - see
     * yandex_wrapper.js's purchaseCurrencyPack). Skipped entirely where the
     * platform doesn't sell it, same as remove-ads. Unlike remove-ads
     * though, it's pointless before isShopUnlocked() - there's nothing to
     * spend the currency on yet - so it's hidden (not just gated on a buy
     * button) until that same level, see renderCountsAndStatus.
     */
    createCurrencyPackSection() {
        if (!this.root.app.platformWrapper.getSupportsCurrencyPackPurchase()) {
            return;
        }

        const pack = T.ingame.currencyShop.currencyPack;
        const container = makeDiv(this.contentDiv, null, ["dailyBonus", "hasPrice"]);
        this.currencyPackContainer = container;
        makeDiv(container, null, ["title"], pack.title);
        makeDiv(container, null, ["description"], pack.description);
        makeDiv(container, null, ["priceRub"], pack.price);

        this.currencyPackButton = document.createElement("button");
        this.currencyPackButton.classList.add("buy", "styledButton", "buyable");
        this.currencyPackButton.innerText = pack.buttonBuy;
        container.appendChild(this.currencyPackButton);
        this.trackClicks(this.currencyPackButton, () => this.tryPurchaseCurrencyPack());
    }

    /**
     * Real-money ad-removal purchase (Yandex Payments, not our own
     * currency) - gates every banner/interstitial call site in
     * yandex_wrapper.js. Skipped entirely where the platform doesn't sell
     * it (see PlatformWrapperImplBrowser.getSupportsAdRemovalPurchase).
     */
    createRemoveAdsSection() {
        if (!this.root.app.platformWrapper.getSupportsAdRemovalPurchase()) {
            return;
        }

        const removeAds = T.ingame.currencyShop.removeAds;
        const container = makeDiv(this.contentDiv, null, ["dailyBonus", "hasPrice"]);
        makeDiv(container, null, ["title"], removeAds.title);
        makeDiv(container, null, ["description"], removeAds.description);
        makeDiv(container, null, ["priceRub"], removeAds.price);

        this.removeAdsButton = document.createElement("button");
        this.removeAdsButton.classList.add("buy", "styledButton");
        container.appendChild(this.removeAdsButton);
        this.trackClicks(this.removeAdsButton, () => this.tryPurchaseAdRemoval());
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReceiver = new InputReceiver("currencyShop");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReceiver);

        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuClose).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuOpenCurrencyShop).add(this.close, this);

        this.close();

        this.lockedDisclaimerElem.innerText = T.ingame.currencyShop.lockedDisclaimer.replace(
            "<level>",
            `${this.getUnlockLevel()}`
        );

        const currencyDefinition = this.root.hubGoals.getCurrencyShapeDefinition();
        if (currencyDefinition) {
            this.currencyIconHolder.appendChild(currencyDefinition.generateAsCanvas(64));
        }

        this.root.signals.shopItemPurchased.add(this.renderCountsAndStatus, this);
    }

    renderCountsAndStatus() {
        // Real-money, not currency - kept updated regardless of the
        // isShopUnlocked() gate below.
        if (this.removeAdsButton) {
            const removeAds = T.ingame.currencyShop.removeAds;
            const purchased = this.root.app.platformWrapper.getAdsDisabled();
            this.removeAdsButton.innerText = purchased ? removeAds.purchased : removeAds.buttonBuy;
            this.removeAdsButton.classList.toggle("buyable", !purchased && !this.purchasingAdRemoval);
        }

        // Consumable - never shows a "Purchased" state, just disabled while
        // a purchase is already in flight. Hidden entirely pre-unlock
        // (see createCurrencyPackSection) - there's nothing to spend it on yet.
        if (this.currencyPackButton) {
            this.currencyPackButton.classList.toggle("buyable", !this.purchasingCurrencyPack);
            this.currencyPackContainer.classList.toggle("hidden", !this.isShopUnlocked());
        }

        // Item cards themselves are never part of the isShopUnlocked() gate
        // below - shown with their price from level 1 so the player knows
        // what's coming, just with no buy button (canPurchaseShopItem's own
        // reward_research check) until the same level that unlocks the rest
        // of the Shop.
        const items = this.root.gameMode.getShopItems();
        for (const itemId in this.itemsToElements) {
            const handle = this.itemsToElements[itemId];
            const item = items[itemId];
            const completed = this.root.hubGoals.isRewardUnlocked(item.reward);
            // Boolean(...) matters here, not just style - classList.toggle(cls, force)
            // treats an explicit `undefined` force as "no force" (plain flip) rather
            // than false, and `item.minLevel && ...`/`item.requires && ...` evaluate to
            // `undefined` (not false) for items missing that field, since `&&` returns
            // the falsy operand as-is. Without the cast, every item lacking minLevel/
            // requires had its levelLocked/requiresLocked class - and the CSS tied to
            // it - flip on and off every single frame the Shop was open.
            const levelLocked = Boolean(
                !completed && item.minLevel && this.root.hubGoals.level < item.minLevel
            );
            // ShopItemDefinition's `requires` (longRoute/autoTunnel/autoMerger/
            // autoSplitter all requiring autoPath) - unlike levelLocked, the
            // price still shows normally (it's a real, currently-unspendable
            // price, not a "not yet available" placeholder); the button's own
            // label carries the prerequisite message instead.
            const requiresLocked = Boolean(
                !completed && !levelLocked && item.requires && !this.root.hubGoals.isRewardUnlocked(item.requires)
            );

            handle.elem.classList.toggle("completed", completed);
            handle.elem.classList.toggle("levelLocked", levelLocked);
            handle.elem.classList.toggle("requiresLocked", requiresLocked);
            if (completed) {
                handle.elemPrice.innerText = T.ingame.currencyShop.completed;
            } else if (levelLocked) {
                handle.elemPrice.innerText = T.ingame.currencyShop.lockedUntilLevel.replace(
                    "<level>",
                    "" + item.minLevel
                );
            } else {
                handle.elemPrice.innerText = formatBigNumber(item.price);
            }
            if (requiresLocked) {
                const requiredItemId = Object.keys(items).find(id => items[id].reward === item.requires);
                handle.buyButton.innerText = T.ingame.currencyShop.requiresItem.replace(
                    "<item>",
                    T.shopItems[requiredItemId].name
                );
            } else {
                handle.buyButton.innerText = T.ingame.currencyShop.buttonBuy;
            }
            handle.buyButton.classList.toggle(
                "buyable",
                !completed && this.root.hubGoals.canPurchaseShopItem(itemId)
            );
        }

        const unlocked = this.isShopUnlocked();
        this.gatedContent.classList.toggle("hidden", !unlocked);
        this.lockedDisclaimerElem.classList.toggle("hidden", unlocked);
        if (!unlocked) {
            // toggle(cls, true), not add(cls) - add() unconditionally rewrites the
            // class attribute even when the class is already present (unlike
            // toggle() with a matching force, which no-ops), so this ran every
            // single frame the Shop was open pre-unlock.
            this.sessionLockedDisclaimerElem.classList.toggle("hidden", true);
            return;
        }

        const sessionLocked = this.root.app.wallet.locked;
        this.sessionLockedDisclaimerElem.classList.toggle("hidden", !sessionLocked);
        this.gatedContent.classList.toggle("hidden", sessionLocked);
        if (sessionLocked) {
            return;
        }

        this.balanceAmountElem.innerText = formatBigNumber(this.root.hubGoals.getCurrencyAmount());

        const exchangeUnlocked = this.root.hubGoals.isExchangeUnlocked();
        this.exchangePriceElem.classList.toggle("hidden", exchangeUnlocked);
        if (exchangeUnlocked) {
            this.exchangeButton.innerText = T.ingame.currencyShop.buttonExchangeLimit.replace(
                "<amount>",
                formatBigNumber(this.root.hubGoals.getExchangeOperationsRemaining())
            );
        } else {
            this.exchangePriceElem.innerText = formatBigNumber(
                this.root.gameMode.getShopItems().exchange.price
            );
            this.exchangeButton.innerText = T.ingame.currencyShop.buttonExchange;
        }

        const daily = T.ingame.currencyShop.dailyBonus;
        const canClaimDaily = this.root.hubGoals.canClaimDailyBonus();
        this.dailyBonusButton.innerText = canClaimDaily
            ? daily.buttonClaim.replace("<amount>", formatBigNumber(this.root.hubGoals.getDailyBonusAmount()))
            : daily.claimed;
        this.dailyBonusButton.classList.toggle("buyable", canClaimDaily);

        if (this.adRewardButton) {
            const ad = T.ingame.currencyShop.adReward;
            const canClaimAd = this.root.hubGoals.canClaimAdReward();
            this.adRewardButton.innerText = canClaimAd
                ? ad.buttonClaim.replace("<amount>", formatBigNumber(this.root.hubGoals.getAdRewardAmount()))
                : ad.cooldown.replace(
                      "<time>",
                      formatSeconds(this.root.hubGoals.getAdRewardCooldownSeconds())
                  );
            this.adRewardButton.classList.toggle("buyable", !this.claimingAdReward && canClaimAd);
        }
    }

    show() {
        this.visible = true;
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReceiver);
        this.renderCountsAndStatus();
    }

    close() {
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReceiver);
        this.update();
    }

    update() {
        this.domAttach.update(this.visible);
        if (this.visible) {
            this.renderCountsAndStatus();
        }
    }

    tryPurchaseItem(itemId) {
        if (this.root.hubGoals.tryPurchaseShopItem(itemId)) {
            this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
        }
    }

    tryClaimDailyBonus() {
        if (this.root.hubGoals.tryClaimDailyBonus()) {
            this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
            this.renderCountsAndStatus();
        }
    }

    async tryClaimAdReward() {
        if (this.claimingAdReward || !this.root.hubGoals.canClaimAdReward()) {
            return;
        }
        this.claimingAdReward = true;
        this.renderCountsAndStatus();

        const watched = await this.root.app.platformWrapper.showRewardedAd();

        this.claimingAdReward = false;
        if (watched && this.root.hubGoals.grantAdReward()) {
            this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
        }
        this.renderCountsAndStatus();
    }

    async tryPurchaseCurrencyPack() {
        if (this.purchasingCurrencyPack) {
            return;
        }
        this.purchasingCurrencyPack = true;
        this.renderCountsAndStatus();

        const purchased = await this.root.app.platformWrapper.purchaseCurrencyPack();

        this.purchasingCurrencyPack = false;
        if (purchased && this.root.hubGoals.grantCurrencyPackPurchase()) {
            this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
        }
        this.renderCountsAndStatus();
    }

    async tryPurchaseAdRemoval() {
        if (this.purchasingAdRemoval || this.root.app.platformWrapper.getAdsDisabled()) {
            return;
        }
        this.purchasingAdRemoval = true;
        this.renderCountsAndStatus();

        const purchased = await this.root.app.platformWrapper.purchaseAdRemoval();

        this.purchasingAdRemoval = false;
        if (purchased) {
            this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
        }
        this.renderCountsAndStatus();
    }

    isBlockingOverlay() {
        return this.visible;
    }
}
