import { ClickDetector } from "../../../core/click_detector";
import { IS_MOBILE } from "../../../core/config";
import { InputReceiver } from "../../../core/input_receiver";
import { DialogWithForm } from "../../../core/modal_dialog_elements";
import { FormElementInput } from "../../../core/modal_dialog_forms";
import { makeDiv, makeDivElement, removeAllChildren } from "../../../core/utils";
import { SOUNDS } from "../../../platform/sound";
import { T } from "../../../translations";
import { Blueprint } from "../../blueprint";
import { KEYMAPPINGS, KeyActionMapper } from "../../key_action_mapper";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { enumNotificationType } from "./notifications";

/**
 * Account-wide library of saved, reusable blueprints (app.blueprintLibrary,
 * see blueprint_library_storage.js) - separate from the copy/paste-only
 * "last blueprint" desktop and mobile controls already offer. Saving and
 * equipping both funnel through the same Blueprint class/currentBlueprint
 * TrackedState that mass-select copy and mobile's copy button already use,
 * so placement, rotation, and cost all come for free.
 */
export class HUDBlueprintLibrary extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_BlueprintLibrary", ["ingameDialog"]);

        this.dialogInner = makeDiv(this.background, null, ["dialogInner"]);
        this.title = makeDiv(this.dialogInner, null, ["title"], T.ingame.blueprintLibrary.title);
        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);

        this.contentDiv = makeDiv(this.dialogInner, null, ["content"]);

        const toolbar = makeDiv(this.contentDiv, null, ["toolbar"]);
        this.searchInput = document.createElement("input");
        this.searchInput.type = "text";
        this.searchInput.classList.add("search");
        this.searchInput.placeholder = T.ingame.blueprintLibrary.searchPlaceholder;
        toolbar.appendChild(this.searchInput);
        this.searchInput.addEventListener("input", () => {
            this.searchQuery = this.searchInput.value.toLowerCase();
            this.renderGrid();
        });

        this.tagFilterElem = makeDiv(toolbar, null, ["tagFilter"]);

        this.emptyElem = makeDiv(this.contentDiv, null, ["empty"]);
        this.gridElem = makeDiv(this.contentDiv, null, ["grid"]);
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReceiver = new InputReceiver("blueprintLibrary");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReceiver);
        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuClose).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuOpenBlueprintLibrary).add(this.close, this);

        // Opening is wired declaratively through game_menu.js's button list
        // (same key, same pattern as menuOpenCurrencyShop/menuOpenStats) -
        // this only needs to handle closing while already open, above.
        this.root.keyMapper
            .getBinding(KEYMAPPINGS.massSelect.saveSelectionToLibrary)
            .add(this.handleSaveHotkey, this);

        this.searchQuery = "";
        this.activeTagFilter = null;
        /** @type {Map<string, {blueprint: Blueprint, cost: unknown, lockedCount: number}>} */
        this.cardCache = new Map();

        this.close();
    }

    isBlueprintsUnlocked() {
        return this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_blueprints);
    }

    showBlueprintsNotUnlocked() {
        this.root.hud.parts.dialogs.showInfo(
            T.dialogs.blueprintsNotUnlocked.title,
            T.dialogs.blueprintsNotUnlocked.desc
        );
    }

    notify(message, type) {
        this.root.hud.signals.notification.dispatch(message, type);
    }

    /**
     * Click detectors for elements rebuilt on every render (tag chips, card
     * buttons) - kept out of BaseHUDPart's own this.clickDetectors (which
     * is only ever cleaned up once, on full HUD teardown) and cleaned up
     * per-bucket instead, right before each rebuild. Without this, every
     * keystroke while searching (renderGrid) or every save/delete (render)
     * would leak a fresh batch of detectors bound to now-detached DOM
     * nodes - the same class of bug the original Blueprint Library mod's
     * changelog called out as a memory leak fix.
     * @param {"tagFilterClickDetectors"|"cardClickDetectors"} bucket
     * @param {Element} element
     * @param {import("../../../core/signal").SignalReceiver<[]>} handler
     */
    trackDynamicClick(bucket, element, handler) {
        if (!this[bucket]) {
            this[bucket] = [];
        }
        const detector = new ClickDetector(element, {});
        detector.click.add(handler, this);
        this[bucket].push(detector);
    }

    /** @param {"tagFilterClickDetectors"|"cardClickDetectors"} bucket */
    cleanupDynamicClickDetectors(bucket) {
        if (this[bucket]) {
            for (const detector of this[bucket]) {
                detector.cleanup();
            }
            this[bucket] = [];
        }
    }

    cleanup() {
        this.cleanupDynamicClickDetectors("tagFilterClickDetectors");
        this.cleanupDynamicClickDetectors("cardClickDetectors");
        super.cleanup();
    }

    /**
     * Ctrl/whatever-bound "save selection to library" hotkey (desktop only
     * - mobile has its own button, see mobile_controls.js's
     * onSaveToLibraryClicked, which calls trySaveSelection directly).
     */
    handleSaveHotkey() {
        const massSelector = this.root.hud.parts.massSelector;
        const uids = massSelector ? Array.from(massSelector.selectedUids) : [];
        this.trySaveSelection(uids);
    }

    /**
     * @param {Array<number>} uids
     */
    trySaveSelection(uids) {
        if (!this.isBlueprintsUnlocked()) {
            this.showBlueprintsNotUnlocked();
            return;
        }
        if (!uids || uids.length === 0) {
            this.notify(T.ingame.blueprintLibrary.emptySelectionError, enumNotificationType.error);
            return;
        }
        const blueprint = Blueprint.fromUids(this.root, uids);
        this.openSaveDialog(blueprint);
    }

    /**
     * @param {Blueprint} blueprint
     */
    openSaveDialog(blueprint) {
        const t = T.ingame.blueprintLibrary.saveDialog;
        const nameInput = new FormElementInput({
            id: "name",
            label: t.nameLabel,
            placeholder: t.namePlaceholder,
            defaultValue: "",
        });
        const tagsInput = new FormElementInput({
            id: "tags",
            label: t.tagsLabel,
            placeholder: t.tagsPlaceholder,
            defaultValue: "",
        });
        const dialog = new DialogWithForm({
            app: this.root.app,
            title: t.title,
            desc: t.desc,
            formElements: [nameInput, tagsInput],
            buttons: ["cancel:bad:escape", "ok:good:enter"],
        });
        this.root.hud.parts.dialogs.internalShowDialog(dialog);
        dialog.buttonSignals.ok.add(() => {
            const tags = tagsInput
                .getValue()
                .split(",")
                .map(tag => tag.trim())
                .filter(Boolean);
            this.root.app.blueprintLibrary.add(nameInput.getValue(), blueprint.serializeEntities(), tags);
            this.notify(T.ingame.blueprintLibrary.savedNotification, enumNotificationType.success);
            this.root.app.sound.playUiSound(SOUNDS.dialogOk);
            if (this.visible) {
                this.cardCache.clear();
                this.render();
            }
        });
    }

    /**
     * @param {object} entry
     */
    openEditDialog(entry) {
        const t = T.ingame.blueprintLibrary.saveDialog;
        const nameInput = new FormElementInput({
            id: "name",
            label: t.nameLabel,
            placeholder: t.namePlaceholder,
            defaultValue: entry.name,
        });
        const tagsInput = new FormElementInput({
            id: "tags",
            label: t.tagsLabel,
            placeholder: t.tagsPlaceholder,
            defaultValue: entry.tags.join(", "),
        });
        const dialog = new DialogWithForm({
            app: this.root.app,
            title: T.ingame.blueprintLibrary.editDialog.title,
            desc: t.desc,
            formElements: [nameInput, tagsInput],
            buttons: ["cancel:bad:escape", "ok:good:enter"],
        });
        this.root.hud.parts.dialogs.internalShowDialog(dialog);
        dialog.buttonSignals.ok.add(() => {
            const tags = tagsInput
                .getValue()
                .split(",")
                .map(tag => tag.trim())
                .filter(Boolean);
            // No explicit cache invalidation needed - getCardData's cache
            // key includes updatedAt, which update() just bumped, so the
            // next lookup naturally misses and rebuilds.
            this.root.app.blueprintLibrary.update(entry.id, { name: nameInput.getValue(), tags });
            this.render();
        });
    }

    /**
     * @param {object} entry
     */
    deleteBlueprint(entry) {
        const signals = this.root.hud.parts.dialogs.showWarning(
            T.ingame.blueprintLibrary.deleteConfirm.title,
            T.ingame.blueprintLibrary.deleteConfirm.desc.replace("<name>", entry.name),
            ["cancel:good", "delete:bad:enter"]
        );
        signals.delete.add(() => {
            this.root.app.blueprintLibrary.remove(entry.id);
            this.notify(T.ingame.blueprintLibrary.deletedNotification, enumNotificationType.info);
            this.render();
        });
    }

    /**
     * @param {object} entry
     * @returns {{blueprint: Blueprint, cost: unknown, lockedCount: number}}
     */
    getCardData(entry) {
        const cacheKey = entry.id + ":" + entry.updatedAt;
        let cached = this.cardCache.get(cacheKey);
        if (!cached) {
            const blueprint = Blueprint.fromSerializedEntities(this.root, entry.entities);
            cached = {
                blueprint,
                cost: blueprint.getCost(),
                lockedCount: blueprint.getLockedEntities(this.root).length,
            };
            this.cardCache.set(cacheKey, cached);
        }
        return cached;
    }

    /**
     * @param {object} entry
     */
    equipBlueprint(entry) {
        const { blueprint, lockedCount } = this.getCardData(entry);
        if (lockedCount > 0) {
            return;
        }
        const blueprintPlacer = this.root.hud.parts.blueprintPlacer;
        blueprintPlacer.lastBlueprintUsed = blueprint;
        blueprintPlacer.currentBlueprint.set(blueprint);
        const mobileControls = this.root.hud.parts.mobileControls;
        if (mobileControls) {
            mobileControls.enterCopiedBlueprintMode();
        }
        this.close();
    }

    show() {
        if (!this.isBlueprintsUnlocked()) {
            this.showBlueprintsNotUnlocked();
            return;
        }
        this.visible = true;
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReceiver);
        this.render();
    }

    close() {
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReceiver);
        this.update();
    }

    update() {
        this.domAttach.update(this.visible);
    }

    render() {
        this.cleanupDynamicClickDetectors("tagFilterClickDetectors");
        removeAllChildren(this.tagFilterElem);
        const t = T.ingame.blueprintLibrary;

        const allButton = document.createElement("button");
        allButton.classList.toggle("active", this.activeTagFilter === null);
        allButton.innerText = t.allTagsFilter;
        this.tagFilterElem.appendChild(allButton);
        this.trackDynamicClick("tagFilterClickDetectors", allButton, () => {
            this.activeTagFilter = null;
            this.renderGrid();
        });

        for (const tag of this.root.app.blueprintLibrary.getTags()) {
            const button = document.createElement("button");
            button.classList.toggle("active", this.activeTagFilter === tag);
            button.innerText = tag;
            this.tagFilterElem.appendChild(button);
            this.trackDynamicClick("tagFilterClickDetectors", button, () => {
                this.activeTagFilter = tag;
                this.renderGrid();
            });
        }

        this.renderGrid();
    }

    renderGrid() {
        this.cleanupDynamicClickDetectors("cardClickDetectors");
        removeAllChildren(this.gridElem);
        const t = T.ingame.blueprintLibrary;

        let entries = this.root.app.blueprintLibrary.getAll();
        if (this.searchQuery) {
            entries = entries.filter(entry => entry.name.toLowerCase().includes(this.searchQuery));
        }
        if (this.activeTagFilter) {
            entries = entries.filter(entry => entry.tags.includes(this.activeTagFilter));
        }

        const isEmptyLibrary = this.root.app.blueprintLibrary.getAll().length === 0;
        this.emptyElem.classList.toggle("hidden", !isEmptyLibrary);
        this.gridElem.classList.toggle("hidden", isEmptyLibrary);
        if (isEmptyLibrary) {
            this.emptyElem.innerHTML = IS_MOBILE
                ? t.emptyMobile
                : t.empty.replace(
                      "<keybinding>",
                      `<kbd>${this.root.keyMapper
                          .getBinding(KEYMAPPINGS.massSelect.saveSelectionToLibrary)
                          .getKeyCodeString()}</kbd>`
                  );
            return;
        }

        for (const entry of entries) {
            this.gridElem.appendChild(this.createCard(entry));
        }
    }

    /**
     * @param {object} entry
     */
    createCard(entry) {
        const t = T.ingame.blueprintLibrary;
        const { cost, lockedCount } = this.getCardData(entry);

        const card = makeDivElement(null, ["blueprintCard"]);

        const info = makeDiv(card, null, ["info"]);
        makeDiv(info, null, ["name"], entry.name);
        if (entry.tags.length > 0) {
            makeDiv(info, null, ["tags"], entry.tags.join(", "));
        }
        makeDiv(info, null, ["meta"], t.buildingCount.replace("<count>", "" + entry.entities.length));

        const costElem = makeDiv(card, null, ["cost"]);
        const currencyShapeKey = this.root.gameMode.getBlueprintShapeKey();
        const shapeDefinition = this.root.shapeDefinitionMgr.getShapeFromShortKey(currencyShapeKey);
        if (shapeDefinition) {
            const iconHolder = makeDiv(costElem, null, ["icon"]);
            iconHolder.appendChild(shapeDefinition.generateAsCanvas(24));
        }
        makeDiv(costElem, null, ["amount"], "" + cost);

        if (lockedCount > 0) {
            makeDiv(card, null, ["lockedWarning"], t.lockedWarning);
        }

        const actions = makeDiv(card, null, ["actions"]);

        const equipButton = document.createElement("button");
        equipButton.classList.add("equip", "styledButton");
        equipButton.innerText = t.buttonEquip;
        actions.appendChild(equipButton);
        if (lockedCount > 0) {
            equipButton.classList.add("disabled");
            equipButton.disabled = true;
        } else {
            this.trackDynamicClick("cardClickDetectors", equipButton, () => this.equipBlueprint(entry));
        }

        const editButton = document.createElement("button");
        editButton.classList.add("edit", "styledButton");
        editButton.innerText = t.buttonEdit;
        actions.appendChild(editButton);
        this.trackDynamicClick("cardClickDetectors", editButton, () => this.openEditDialog(entry));

        const deleteButton = document.createElement("button");
        deleteButton.classList.add("delete", "styledButton");
        deleteButton.innerText = t.buttonDelete;
        actions.appendChild(deleteButton);
        this.trackDynamicClick("cardClickDetectors", deleteButton, () => this.deleteBlueprint(entry));

        return card;
    }

    isBlockingOverlay() {
        return this.visible;
    }
}
