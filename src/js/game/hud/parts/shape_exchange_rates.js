import { formatBigNumber, makeDiv, removeAllChildren } from "../../../core/utils";
import { InputReceiver } from "../../../core/input_receiver";
import { T } from "../../../translations";
import { KEYMAPPINGS, KeyActionMapper } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

// The exchange rate formula (hub_goals.js's getShapeBuyCostPerUnit/
// getShapeAmountStep) is defined for any layer count, but real shapes in
// this game never exceed 4 layers (see computeFreeplayShape's clamp) - the
// reference table only needs to cover that range.
const MAX_EXAMPLE_LAYERS = 4;

/**
 * Static "Курс" reference table, opened from shape_exchange_list.js -
 * one example shape (plain and painted) per layer count, with its buy/sell
 * rate. Not tied to inventory, purely informational.
 */
export class HUDShapeExchangeRates extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_ShapeExchangeRates", ["ingameDialog"]);

        this.dialogInner = makeDiv(this.background, null, ["dialogInner"]);
        this.title = makeDiv(this.dialogInner, null, ["title"], T.ingame.currencyShop.exchangeRates.title);
        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);
        this.contentDiv = makeDiv(this.dialogInner, null, ["content"]);

        this.rowsElem = makeDiv(this.contentDiv, null, ["rows"]);
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReceiver = new InputReceiver("shapeExchangeRates");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReceiver);
        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuClose).add(this.close, this);

        this.close();
    }

    renderRows() {
        removeAllChildren(this.rowsElem);
        const text = T.ingame.currencyShop.exchangeRates;

        for (let layers = 1; layers <= MAX_EXAMPLE_LAYERS; ++layers) {
            for (const colored of [false, true]) {
                const layerCode = colored ? "CrCrCrCr" : "CuCuCuCu";
                const code = new Array(layers).fill(layerCode).join(":");
                const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(code);

                const row = makeDiv(this.rowsElem, null, ["row"]);
                const icon = makeDiv(row, null, ["icon"]);
                icon.appendChild(definition.generateAsCanvas(56));

                const info = makeDiv(row, null, ["info"]);
                const label = text.layers.replace("<layers>", layers) + (colored ? " " + text.colored : "");
                makeDiv(info, null, ["label"], label);

                const buyCost = this.root.hubGoals.getShapeBuyCostPerUnit(layers, colored);
                const sellStep = this.root.hubGoals.getShapeAmountStep(layers, colored, "sell");

                makeDiv(info, null, ["buyRate"], text.buyRate.replace("<currency>", formatBigNumber(buyCost)));
                makeDiv(info, null, ["sellRate"], text.sellRate.replace("<shapes>", formatBigNumber(sellStep)));
            }
        }
    }

    show() {
        this.visible = true;
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReceiver);
        this.renderRows();
    }

    close() {
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReceiver);
        this.update();
    }

    update() {
        this.domAttach.update(this.visible);
    }

    isBlockingOverlay() {
        return this.visible;
    }
}
