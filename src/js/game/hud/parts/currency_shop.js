import { formatBigNumber, formatSeconds, makeDiv } from "../../../core/utils";
import { SOUNDS } from "../../../platform/sound";
import { T } from "../../../translations";
import { KEYMAPPINGS, KeyActionMapper } from "../../key_action_mapper";
import { InputReceiver } from "../../../core/input_receiver";
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

        // Balance header - the currency's own shape icon plus how many the
        // player has, exactly the way requirement amounts are shown
        // elsewhere (shop.js's createRequirementElement) - plus the
        // "Обмен" button, pushed to the row's right edge. Exchange is itself
        // a purchasable Shop feature (see hub_goals.js's reward_shop_exchange),
        // so its price shows next to the button until bought - wrapped
        // together so the pair moves as one unit regardless of whether the
        // price is visible.
        this.balanceElem = makeDiv(this.contentDiv, null, ["currencyBalance"]);
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
        this.createRemoveAdsSection();

        // One-off toggle purchases - "exchange" is deliberately excluded,
        // its purchase UI lives next to the balance row / inside
        // shape_exchange_list.js instead of a generic card here.
        this.itemsToElements = {};
        const items = this.root.gameMode.getShopItems();
        for (const itemId in items) {
            if (itemId === "exchange") {
                continue;
            }
            const handle = {};

            handle.elem = makeDiv(this.contentDiv, null, ["shopItem"]);
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
     * The once-a-day free currency claim - real wall-clock time, works
     * before any ad/IAP integration exists (see hub_goals.js).
     */
    createDailyBonusSection() {
        const daily = T.ingame.currencyShop.dailyBonus;
        const container = makeDiv(this.contentDiv, null, ["dailyBonus"]);
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
        const container = makeDiv(this.contentDiv, null, ["dailyBonus"]);
        makeDiv(container, null, ["title"], ad.title);
        makeDiv(container, null, ["description"], ad.description);

        this.adRewardButton = document.createElement("button");
        this.adRewardButton.classList.add("buy", "styledButton");
        container.appendChild(this.adRewardButton);
        this.trackClicks(this.adRewardButton, () => this.tryClaimAdReward());
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
        const container = makeDiv(this.contentDiv, null, ["dailyBonus"]);
        makeDiv(container, null, ["title"], removeAds.title);
        makeDiv(container, null, ["description"], removeAds.description);

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

        const currencyDefinition = this.root.hubGoals.getCurrencyShapeDefinition();
        if (currencyDefinition) {
            this.currencyIconHolder.appendChild(currencyDefinition.generateAsCanvas(64));
        }

        this.root.signals.shopItemPurchased.add(this.renderCountsAndStatus, this);
    }

    renderCountsAndStatus() {
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

        if (this.removeAdsButton) {
            const removeAds = T.ingame.currencyShop.removeAds;
            const purchased = this.root.app.platformWrapper.getAdsDisabled();
            this.removeAdsButton.innerText = purchased ? removeAds.purchased : removeAds.buttonBuy;
            this.removeAdsButton.classList.toggle("buyable", !purchased && !this.purchasingAdRemoval);
        }

        const items = this.root.gameMode.getShopItems();
        for (const itemId in this.itemsToElements) {
            const handle = this.itemsToElements[itemId];
            const item = items[itemId];
            const completed = this.root.hubGoals.isRewardUnlocked(item.reward);

            handle.elem.classList.toggle("completed", completed);
            handle.elemPrice.innerText = completed
                ? T.ingame.currencyShop.completed
                : formatBigNumber(item.price);
            handle.buyButton.classList.toggle(
                "buyable",
                !completed && this.root.hubGoals.canPurchaseShopItem(itemId)
            );
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
