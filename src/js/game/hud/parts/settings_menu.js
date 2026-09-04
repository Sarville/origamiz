import { InputReceiver } from "../../../core/input_receiver";
import { formatBigNumberFull, makeButton, makeDiv, removeAllChildren } from "../../../core/utils";
import { T } from "../../../translations";
import { BeltComponent } from "../../components/belt";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { KEYMAPPINGS, KeyActionMapper } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

export class HUDSettingsMenu extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_SettingsMenu", ["ingameDialog"]);

        this.menuElement = makeDiv(this.background, null, ["menuElement"]);

        if (this.root.gameMode.hasHub()) {
            this.statsElement = makeDiv(
                this.background,
                null,
                ["statsElement"],
                `
            <strong>${T.ingame.settingsMenu.beltsPlaced}</strong><span class="beltsPlaced"></span>
            <strong>${T.ingame.settingsMenu.buildingsPlaced}</strong><span class="buildingsPlaced"></span>
            <strong>${T.ingame.settingsMenu.playtime}</strong><span class="playtime"></span>

            `
            );
        }

        this.buttonContainer = makeDiv(this.menuElement, null, ["buttons"]);
        this.yandexAuthMount = makeDiv(this.menuElement, null, ["yandexAuthMount"]);

        const buttons = [
            {
                id: "continue",
                action: () => this.close(),
            },
            {
                id: "settings",
                action: () => this.goToSettings(),
            },
            {
                id: "menu",
                action: () => this.returnToMenu(),
            },
        ];

        for (let i = 0; i < buttons.length; ++i) {
            const { action, id } = buttons[i];

            const element = document.createElement("button");
            element.classList.add("styledButton");
            element.classList.add(id);
            this.buttonContainer.appendChild(element);

            this.trackClicks(element, action);
        }
    }

    isBlockingOverlay() {
        return this.visible;
    }

    returnToMenu() {
        this.root.gameState.goBackToMenu();
    }

    /**
     * Shows the "Sign in with Yandex ID" button between the icon row and
     * the stats footer - hidden on platforms without sign-in support, or
     * once the player is already signed in. No unsolicited offer modal here
     * (see yandex_auth.js) - clicking this button is already the deliberate
     * action platform requirement 1.2.1 asks for.
     */
    renderYandexAuth() {
        removeAllChildren(this.yandexAuthMount);

        if (!this.root.app.platformWrapper.getSupportsAuth() || this.root.app.platformWrapper.isAuthorized()) {
            return;
        }

        this.trackClicks(
            makeButton(this.yandexAuthMount, ["yandexAuthButton", "styledButton"], T.yandexAuth.loginButton),
            this.onYandexAuthButtonClicked
        );
    }

    async onYandexAuthButtonClicked() {
        await this.root.app.platformWrapper.requestAuth();
        this.renderYandexAuth();
    }

    goToSettings() {
        this.root.gameState.goToSettings();
    }

    shouldPauseGame() {
        return this.visible;
    }

    shouldPauseRendering() {
        return this.visible;
    }

    initialize() {
        this.root.keyMapper.getBinding(KEYMAPPINGS.general.back).add(this.show, this);

        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReceiver = new InputReceiver("settingsmenu");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReceiver);
        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);

        this.close();
    }

    show() {
        this.visible = true;
        this.root.app.platformWrapper.onGameplayStop();
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReceiver);
        this.renderYandexAuth();

        const totalMinutesPlayed = Math.ceil(this.root.time.now() / 60);

        if (this.root.gameMode.hasHub()) {
            /** @type {HTMLElement} */
            const playtimeElement = this.statsElement.querySelector(".playtime");
            /** @type {HTMLElement} */
            const buildingsPlacedElement = this.statsElement.querySelector(".buildingsPlaced");
            /** @type {HTMLElement} */
            const beltsPlacedElement = this.statsElement.querySelector(".beltsPlaced");

            playtimeElement.innerText = T.global.time.xMinutes.replace("<x>", `${totalMinutesPlayed}`);

            buildingsPlacedElement.innerText = formatBigNumberFull(
                this.root.entityMgr.getAllWithComponent(StaticMapEntityComponent).length -
                    this.root.entityMgr.getAllWithComponent(BeltComponent).length
            );

            beltsPlacedElement.innerText = formatBigNumberFull(
                this.root.entityMgr.getAllWithComponent(BeltComponent).length
            );
        }
    }

    close() {
        if (this.visible) {
            this.root.app.platformWrapper.onGameplayStart();
        }
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReceiver);
        this.update();
    }

    cleanup() {
        super.cleanup();

        // Detach the input receiver when leaving InGameState
        this.root.app.inputMgr.makeSureDetached(this.inputReceiver);
    }

    update() {
        this.domAttach.update(this.visible);
    }
}
