import { formatBigNumber, makeDiv, removeAllChildren } from "../../../core/utils";
import { InputReceiver } from "../../../core/input_receiver";
import { SOUNDS } from "../../../platform/sound";
import { T } from "../../../translations";
import { KEYMAPPINGS, KeyActionMapper } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

/**
 * The "Exchange" window, opened from the Shop's header button - lists every
 * shape currently in storedShapes (the player's whole delivered-shape
 * inventory, same bookkeeping research/upgrades already use) with a Buy and
 * a Sell button each. Both open shape_exchange_modal.js for the actual
 * amount entry and confirmation; this list only browses and dispatches.
 *
 * Exchange is itself a purchasable Shop feature (hub_goals.js's
 * reward_shop_exchange) - until bought, the list is replaced by a
 * description + buy panel. Once bought, buy/sell operations are limited to
 * a few per real-world day (hub_goals.js's exchangeOperationsRemaining),
 * raisable with a repeatable purchase; once the daily limit hits 0 the row
 * list is replaced by a "limit reached" message (the Rates button stays
 * available either way, it's in the title bar).
 */
export class HUDShapeExchangeList extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_ShapeExchangeList", ["ingameDialog"]);

        this.dialogInner = makeDiv(this.background, null, ["dialogInner"]);
        this.title = makeDiv(this.dialogInner, null, ["title"], T.ingame.currencyShop.exchangeList.title);

        this.ratesButton = document.createElement("button");
        this.ratesButton.classList.add("ratesButton", "styledButton");
        this.ratesButton.innerText = T.ingame.currencyShop.exchangeList.buttonRates;
        this.title.appendChild(this.ratesButton);
        this.trackClicks(this.ratesButton, () => this.root.hud.parts.shapeExchangeRates.show());

        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);
        this.contentDiv = makeDiv(this.dialogInner, null, ["content"]);

        // Daily limit bar - only shown once Exchange itself is purchased.
        this.limitBar = makeDiv(this.contentDiv, null, ["limitBar"]);
        this.limitTextElem = makeDiv(this.limitBar, null, ["limitText"]);
        this.raiseLimitButton = document.createElement("button");
        this.raiseLimitButton.classList.add("raiseLimit", "styledButton");
        this.limitBar.appendChild(this.raiseLimitButton);
        this.trackClicks(this.raiseLimitButton, () => this.tryRaiseLimit());

        // Locked panel - shown instead of everything below until Exchange is bought.
        this.lockedPanel = makeDiv(this.contentDiv, null, ["lockedPanel"]);
        makeDiv(
            this.lockedPanel,
            null,
            ["description"],
            T.ingame.currencyShop.exchangeList.lockedDescription
        );
        this.unlockPriceElem = makeDiv(this.lockedPanel, null, ["price"]);
        this.unlockButton = document.createElement("button");
        this.unlockButton.classList.add("buy", "styledButton");
        this.unlockButton.innerText = T.ingame.currencyShop.exchangeList.buttonUnlock;
        this.lockedPanel.appendChild(this.unlockButton);
        this.trackClicks(this.unlockButton, () => this.tryUnlockExchange());

        this.emptyElem = makeDiv(
            this.contentDiv,
            null,
            ["empty"],
            T.ingame.currencyShop.exchangeList.empty
        );
        this.limitExhaustedElem = makeDiv(
            this.contentDiv,
            null,
            ["empty"],
            T.ingame.currencyShop.exchangeList.limitExhausted
        );
        this.rowsElem = makeDiv(this.contentDiv, null, ["rows"]);

        /** @type {Object<string, { row: HTMLElement, amountElem: HTMLElement }>} */
        this.rowsByHash = {};
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReceiver = new InputReceiver("shapeExchangeList");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReceiver);
        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuClose).add(this.close, this);

        this.close();
    }

    tryUnlockExchange() {
        if (this.root.hubGoals.tryPurchaseShopItem("exchange")) {
            this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
            this.refreshState();
        }
    }

    tryRaiseLimit() {
        if (this.root.hubGoals.tryPurchaseExchangeLimitUpgrade()) {
            this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
            this.refreshState();
        }
    }

    /**
     * Decides which of the locked/limit-reached/row-list sections to show
     * and refreshes their content - called on show(), after a purchase, and
     * after every Exchange transaction (see shape_exchange_modal.js's
     * tryConfirm()).
     */
    refreshState() {
        const hubGoals = this.root.hubGoals;
        const unlocked = hubGoals.isExchangeUnlocked();

        this.lockedPanel.classList.toggle("hidden", unlocked);
        this.limitBar.classList.toggle("hidden", !unlocked);

        if (!unlocked) {
            const item = this.root.gameMode.getShopItems().exchange;
            this.unlockPriceElem.innerText = formatBigNumber(item.price);
            this.unlockButton.classList.toggle("buyable", hubGoals.canPurchaseShopItem("exchange"));
            this.emptyElem.classList.add("hidden");
            this.limitExhaustedElem.classList.add("hidden");
            this.rowsElem.classList.add("hidden");
            return;
        }

        const remaining = hubGoals.getExchangeOperationsRemaining();
        this.limitTextElem.innerText = T.ingame.currencyShop.exchangeList.limitText.replace(
            "<amount>",
            formatBigNumber(remaining)
        );

        const maxed = hubGoals.isExchangeLimitMaxed();
        this.raiseLimitButton.classList.toggle("hidden", maxed);
        if (!maxed) {
            this.raiseLimitButton.innerText = T.ingame.currencyShop.exchangeList.buttonRaiseLimit.replace(
                "<price>",
                formatBigNumber(hubGoals.getExchangeLimitUpgradePrice())
            );
            this.raiseLimitButton.classList.toggle("buyable", hubGoals.canPurchaseExchangeLimitUpgrade());
        }

        if (remaining <= 0) {
            this.emptyElem.classList.add("hidden");
            this.rowsElem.classList.add("hidden");
            this.limitExhaustedElem.classList.remove("hidden");
        } else {
            this.limitExhaustedElem.classList.add("hidden");
            this.renderRows();
        }
    }

    /**
     * Full rebuild of the row list from live storedShapes - called on show()
     * and whenever a transaction in shape_exchange_modal.js could have added
     * or zeroed out an entry. A plain per-frame quantity refresh (see
     * update()) is enough for the common case of watching numbers tick up
     * from background production; only a full rebuild adds/removes rows.
     */
    renderRows() {
        removeAllChildren(this.rowsElem);
        this.rowsByHash = {};
        this.rowsElem.classList.remove("hidden");

        const currencyHash = this.root.hubGoals.getCurrencyShapeDefinition()?.getHash();
        const storedShapes = this.root.hubGoals.storedShapes;
        const hashes = Object.keys(storedShapes).filter(
            hash => hash !== currencyHash && storedShapes[hash] > 0
        );

        this.emptyElem.classList.toggle("hidden", hashes.length > 0);

        for (const hash of hashes) {
            const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(hash);

            const row = makeDiv(this.rowsElem, null, ["row"]);
            const icon = makeDiv(row, null, ["icon"]);
            icon.appendChild(definition.generateAsCanvas(64));

            const amountElem = makeDiv(row, null, ["amount"]);

            const buyButton = document.createElement("button");
            buyButton.classList.add("buy", "styledButton");
            buyButton.innerText = T.ingame.currencyShop.exchangeList.buttonBuy;
            row.appendChild(buyButton);
            this.trackClicks(buyButton, () => this.root.hud.parts.shapeExchangeModal.open(hash, "buy"));

            const sellButton = document.createElement("button");
            sellButton.classList.add("sell", "styledButton");
            sellButton.innerText = T.ingame.currencyShop.exchangeList.buttonSell;
            row.appendChild(sellButton);
            this.trackClicks(sellButton, () => this.root.hud.parts.shapeExchangeModal.open(hash, "sell"));

            this.rowsByHash[hash] = { row, amountElem };
        }

        this.refreshQuantities();
    }

    /** Cheap per-frame update - just the amount text of already-rendered rows, no DOM rebuild. */
    refreshQuantities() {
        const storedShapes = this.root.hubGoals.storedShapes;
        for (const hash in this.rowsByHash) {
            this.rowsByHash[hash].amountElem.innerText = formatBigNumber(storedShapes[hash] || 0);
        }
    }

    show() {
        this.visible = true;
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReceiver);
        this.refreshState();
    }

    close() {
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReceiver);
        this.update();
    }

    update() {
        this.domAttach.update(this.visible);
        if (this.visible) {
            this.refreshQuantities();
        }
    }

    isBlockingOverlay() {
        return this.visible;
    }
}
