import { formatBigNumber, makeDiv, removeAllChildren } from "../../../core/utils";
import { InputReceiver } from "../../../core/input_receiver";
import { SOUNDS } from "../../../platform/sound";
import { T } from "../../../translations";
import { KEYMAPPINGS, KeyActionMapper } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

/**
 * The small buy/sell amount-entry + confirm dialog, opened from a row in
 * shape_exchange_list.js for one specific shape and direction. Stacks on
 * top of that list (and the Shop underneath it), same convention as
 * shape_viewer.js layering on top of shop.js.
 */
export class HUDShapeExchangeModal extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_ShapeExchangeModal", ["ingameDialog"]);

        this.dialogInner = makeDiv(this.background, null, ["dialogInner"]);
        this.title = makeDiv(this.dialogInner, null, ["title"]);
        this.titleText = document.createTextNode("");
        this.title.appendChild(this.titleText);
        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);
        this.contentDiv = makeDiv(this.dialogInner, null, ["content"]);

        const header = makeDiv(this.contentDiv, null, ["header"]);
        this.iconElem = makeDiv(header, null, ["icon"]);
        const headerText = makeDiv(header, null, ["headerText"]);
        this.ownedElem = makeDiv(headerText, null, ["owned"]);
        this.rateElem = makeDiv(headerText, null, ["rate"]);

        const amountRow = makeDiv(this.contentDiv, null, ["amountRow"]);
        this.amountInput = document.createElement("input");
        this.amountInput.type = "text";
        this.amountInput.classList.add("amountInput");
        amountRow.appendChild(this.amountInput);

        const stepper = makeDiv(amountRow, null, ["stepper"]);
        this.stepUpButton = document.createElement("button");
        this.stepUpButton.classList.add("stepUp");
        this.stepUpButton.innerText = "▲";
        stepper.appendChild(this.stepUpButton);
        this.stepDownButton = document.createElement("button");
        this.stepDownButton.classList.add("stepDown");
        this.stepDownButton.innerText = "▼";
        stepper.appendChild(this.stepDownButton);

        this.maxButton = document.createElement("button");
        this.maxButton.classList.add("maxButton", "styledButton");
        this.maxButton.innerText = T.ingame.currencyShop.exchangeModal.buttonMax;
        amountRow.appendChild(this.maxButton);
        this.trackClicks(this.maxButton, () => this.setMaxAmount());

        // Reactive only - hidden unless the current amount actually isn't a
        // valid multiple of the step, with a one-click fix instead of
        // silently rewriting the input as the player types (that used to
        // fight manual entry of any bigger number not already a multiple
        // partway through typing it).
        this.warningElem = makeDiv(this.contentDiv, null, ["warning", "hidden"]);
        this.warningText = makeDiv(this.warningElem, null, ["warningText"]);
        this.roundButton = document.createElement("button");
        this.roundButton.classList.add("round", "styledButton");
        this.roundButton.innerText = T.ingame.currencyShop.exchangeModal.buttonRound;
        this.warningElem.appendChild(this.roundButton);
        this.trackClicks(this.roundButton, () => this.roundAmount());

        const priceRow = makeDiv(this.contentDiv, null, ["priceRow"]);
        this.priceElem = makeDiv(priceRow, null, ["price"]);
        this.priceIconElem = makeDiv(priceRow, null, ["priceIcon"]);

        const buttonsRow = makeDiv(this.contentDiv, null, ["buttonsRow"]);
        this.confirmButton = document.createElement("button");
        this.confirmButton.classList.add("confirm", "styledButton");
        buttonsRow.appendChild(this.confirmButton);
        this.trackClicks(this.confirmButton, () => this.tryConfirm());

        this.cancelButton = document.createElement("button");
        this.cancelButton.classList.add("cancel", "styledButton");
        this.cancelButton.innerText = T.ingame.currencyShop.exchangeModal.buttonCancel;
        buttonsRow.appendChild(this.cancelButton);
        this.trackClicks(this.cancelButton, this.close);

        this.amountInput.addEventListener("input", () => this.refresh());
        this.trackClicks(this.stepUpButton, () => this.adjustAmount(1));
        this.trackClicks(this.stepDownButton, () => this.adjustAmount(-1));
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReceiver = new InputReceiver("shapeExchangeModal");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReceiver);
        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuClose).add(this.close, this);

        this.shapeHash = null;
        this.direction = null;
        this.amountStep = 1;
        this.colored = false;

        this.close();
    }

    /**
     * Opens the modal for one shape+direction - resets the amount to the
     * minimum valid step each time, so it always starts from a known-valid
     * state.
     * @param {string} shapeHash
     * @param {"buy"|"sell"} direction
     */
    open(shapeHash, direction) {
        this.shapeHash = shapeHash;
        this.direction = direction;

        const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(shapeHash);
        const layers = definition.layers.length;
        this.layers = layers;
        this.colored = this.root.hubGoals.isShapeColored(definition);
        this.amountStep = this.root.hubGoals.getShapeAmountStep(layers, this.colored, direction);

        const modalText = T.ingame.currencyShop.exchangeModal;
        this.titleText.textContent = direction === "buy" ? modalText.titleBuy : modalText.titleSell;
        this.confirmButton.innerText =
            direction === "buy" ? modalText.buttonConfirmBuy : modalText.buttonConfirmSell;
        this.confirmButton.classList.toggle("buy", direction === "buy");
        this.confirmButton.classList.toggle("sell", direction === "sell");

        removeAllChildren(this.iconElem);
        this.iconElem.appendChild(definition.generateAsCanvas(80));

        removeAllChildren(this.priceIconElem);
        const currencyDefinition = this.root.hubGoals.getCurrencyShapeDefinition();
        if (currencyDefinition) {
            this.priceIconElem.appendChild(currencyDefinition.generateAsCanvas(48));
        }

        const rateValue =
            direction === "buy"
                ? this.root.hubGoals.getShapePurchaseCost(layers, this.colored, this.amountStep)
                : this.root.hubGoals.getShapeSellPayout(layers, this.colored, this.amountStep);
        this.rateElem.innerText = modalText.rate
            .replace("<shapes>", formatBigNumber(this.amountStep))
            .replace("<currency>", formatBigNumber(rateValue));

        // No prefilled value - a placeholder instead, so clicking straight
        // into the field doesn't require erasing anything first.
        this.amountInput.value = "";
        this.amountInput.placeholder = String(this.amountStep);

        this.visible = true;
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReceiver);
        this.refresh();
    }

    /** Nudges the amount up/down by one step, clamped at the step itself (never below). */
    adjustAmount(sign) {
        const current = parseInt(this.amountInput.value, 10);
        const base = Number.isInteger(current) && current > 0 ? current : 0;
        const next = Math.max(this.amountStep, base + sign * this.amountStep);
        this.amountInput.value = String(next);
        this.refresh();
    }

    /** Fills the input with the largest currently valid amount - shapes owned for a sell, whatever currency affords for a buy. */
    setMaxAmount() {
        if (!this.shapeHash) {
            return;
        }
        let max;
        if (this.direction === "buy") {
            const costPerUnit = this.root.hubGoals.getShapeBuyCostPerUnit(this.layers, this.colored);
            max = Math.floor(this.root.hubGoals.getCurrencyAmount() / costPerUnit);
        } else {
            const owned = this.root.hubGoals.getShapesStoredByKey(this.shapeHash);
            max = Math.floor(owned / this.amountStep) * this.amountStep;
        }
        this.amountInput.value = String(Math.max(0, max));
        this.refresh();
    }

    /** Rounds the current amount down to the nearest valid multiple of the step - only ever called explicitly (the round button), never live while typing. */
    roundAmount() {
        const raw = parseInt(this.amountInput.value, 10);
        if (Number.isInteger(raw) && raw >= this.amountStep) {
            this.amountInput.value = String(raw - (raw % this.amountStep));
            this.refresh();
        }
    }

    /** Recomputes the owned/price/valid state from the current amount input - shared by input handlers and the per-frame refresh (currency/owned amounts can change in the background). */
    refresh() {
        if (!this.shapeHash) {
            return;
        }
        const owned = this.root.hubGoals.getShapesStoredByKey(this.shapeHash);
        this.ownedElem.innerText = T.ingame.currencyShop.exchangeModal.owned.replace(
            "<amount>",
            formatBigNumber(owned)
        );

        const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(this.shapeHash);
        const layers = definition.layers.length;
        const amount = parseInt(this.amountInput.value, 10);
        const validAmount = Number.isInteger(amount) && amount > 0 && amount % this.amountStep === 0;

        // Only ever a hint to fix the current, already-typed value - never
        // shown just because this shape's step happens to be > 1.
        const needsRounding = Number.isInteger(amount) && amount >= this.amountStep && amount % this.amountStep !== 0;
        this.warningElem.classList.toggle("hidden", !needsRounding);
        if (needsRounding) {
            this.warningText.innerText = T.ingame.currencyShop.exchangeModal.stepWarning.replace(
                "<step>",
                formatBigNumber(this.amountStep)
            );
        }

        let value = null;
        let valid = false;
        if (validAmount) {
            if (this.direction === "buy") {
                value = this.root.hubGoals.getShapePurchaseCost(layers, this.colored, amount);
                valid = this.root.hubGoals.getCurrencyAmount() >= value;
            } else {
                value = this.root.hubGoals.getShapeSellPayout(layers, this.colored, amount);
                valid = value !== null && owned >= amount;
            }
        }

        this.priceElem.innerText = value === null ? "-" : formatBigNumber(value);
        this.priceElem.classList.toggle("invalid", !valid);
        this.confirmButton.classList.toggle("buyable", valid);

        this.currentAmount = amount;
        this.currentValid = valid;
    }

    tryConfirm() {
        if (!this.currentValid) {
            return;
        }
        const ok =
            this.direction === "buy"
                ? this.root.hubGoals.tryPurchaseShapesWithCurrency(this.shapeHash, this.currentAmount)
                : this.root.hubGoals.sellShapesForCurrency(this.shapeHash, this.currentAmount);
        if (ok) {
            this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
            this.root.hud.parts.shapeExchangeList.refreshState();
            this.close();
        }
    }

    close() {
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReceiver);
        this.update();
    }

    update() {
        this.domAttach.update(this.visible);
        if (this.visible) {
            this.refresh();
        }
    }

    isBlockingOverlay() {
        return this.visible;
    }
}
