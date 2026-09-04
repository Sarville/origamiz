import { APP_NAME, BRAND_AUTHOR, globalConfig } from "../core/config";
import { GameState } from "../core/game_state";
import { DialogWithForm } from "../core/modal_dialog_elements";
import { FormElementInput } from "../core/modal_dialog_forms";
import {
    formatSecondsToTimeAgo,
    makeButton,
    makeDiv,
    makeDivElement,
    removeAllChildren,
    waitNextFrame,
} from "../core/utils";
import { HUDModalDialogs } from "../game/hud/parts/modal_dialogs";
import { MODS } from "../mods/modloader";
import { showYandexAuthOffer, shouldOfferYandexAuth } from "../core/yandex_auth";
import { Savegame } from "../savegame/savegame";
import { T } from "../translations";

/**
 * @typedef {import("../savegame/savegame_typedefs").SavegameMetadata} SavegameMetadata
 */

export class MainMenuState extends GameState {
    constructor() {
        super("MainMenuState");
    }

    getInnerHTML() {
        const hasMods = MODS.allMods.length > 0;

        return `
            <div class="topButtons">
                <button class="achievementsButton" aria-label="${T.mainMenu.achievements}">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="achievementsButtonCup" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" stop-color="#f7efdc"/>
                                <stop offset="1" stop-color="#d8c48f"/>
                            </linearGradient>
                        </defs>
                        <path d="M6 4.25H18V8.35C18 11.05 15.7 13.1 12 14.1C8.3 13.1 6 11.05 6 8.35Z" fill="url(#achievementsButtonCup)" stroke="#6b5636" stroke-width="1.15" stroke-linejoin="round"/>
                        <path d="M6.1 5.25H3.85C3.85 8.05 4.95 9.75 7.35 10.25" fill="none" stroke="#6b5636" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M17.9 5.25H20.15C20.15 8.05 19.05 9.75 16.65 10.25" fill="none" stroke="#6b5636" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M6.58 4.82 12 9.15 17.42 4.82V8.18C17.42 10.43 15.44 12.23 12 13.2 8.56 12.23 6.58 10.43 6.58 8.18Z" fill="#eadbb5"/>
                        <path d="M6.58 4.82 12 9.15V13.2C8.56 12.23 6.58 10.43 6.58 8.18Z" fill="#e1cb98"/>
                        <path d="M17.42 4.82 12 9.15V13.2C15.44 12.23 17.42 10.43 17.42 8.18Z" fill="#f7efdc"/>
                        <path d="M6.58 4.82 12 9.15 17.42 4.82M12 9.15V13.2" fill="none" stroke="#a58d5c" stroke-width=".7" stroke-linejoin="round"/>
                        <path d="M10.45 13.55H13.55V16.75H10.45Z" fill="#d8c48f" stroke="#6b5636" stroke-width="1.05" stroke-linejoin="round"/>
                        <path d="M10.45 13.55 12 15.1 13.55 13.55M12 15.1V16.75" fill="none" stroke="#a58d5c" stroke-width=".65" stroke-linejoin="round"/>
                        <path d="M8.35 17H15.65L17.25 20H6.75Z" fill="#e8d7ab" stroke="#6b5636" stroke-width="1.15" stroke-linejoin="round"/>
                        <path d="M8.35 17 12 19.15 15.65 17M12 19.15V20" fill="none" stroke="#a58d5c" stroke-width=".7" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="settingsButton" aria-label="Settings"></button>
                ${
                    this.app.platformWrapper.getSupportsAppExit()
                        ? `<button class="exitAppButton" aria-label="Exit App"></button>`
                        : ""
                }
            </div>

            <video autoplay muted loop class="fullscreenBackgroundVideo">
                <source src="res/bg_render.webm" type="video/webm">
            </video>

            <div class="logo">
                <img src="res/logo.png" alt="${APP_NAME} Logo"
                    width="${Math.round((710 / 3) * this.app.getEffectiveUiScale())}"
                    height="${Math.round((180 / 3) * this.app.getEffectiveUiScale())}"
                >
            </div>

            <div class="mainWrapper" data-columns="${hasMods ? 2 : 1}">
                <div class="mainContainer">
                    <div class="buttons"></div>
                    <div class="yandexAuthMount"></div>
                    <div class="savegamesMount"></div>
                </div>

                ${
                    hasMods
                        ? `
                <div class="sideContainer">
                        <div class="modsOverview">
                            <div class="header">
                                <h3>${T.mods.title}</h3>
                                <button class="styledButton editMods"></button>
                            </div>
                            <div class="modsList">
                                <div class="mod">
                                    <div class="name">Mod support in progress</div>
                                    <div class="author">Not implemented yet</div>
                                </div>
                            </div>
                        </div>
                </div>
                        `
                        : ""
                }
            </div>

            <div class="footer">

                <div class="brandMark">
                    <span class="name">${BRAND_AUTHOR}</span>
                    <span class="sub">Games</span>
                </div>
            </div>
        `;
    }

    /**
     * Asks the user to import a savegame
     */
    async requestImportSavegame() {
        const closeLoader = this.dialogs.showLoadingDialog();
        await waitNextFrame();

        try {
            const data = await this.app.storage.requestOpenFile("bin");
            if (data === undefined) {
                // User canceled the request
                closeLoader();
                return;
            }

            await this.app.savegameMgr.importSavegame(data);
            closeLoader();
            this.dialogs.showWarning(
                T.dialogs.importSavegameSuccess.title,
                T.dialogs.importSavegameSuccess.text
            );

            this.renderMainMenu();
            this.renderSavegames();
        } catch (err) {
            closeLoader();
            this.dialogs.showWarning(
                T.dialogs.importSavegameError.title,
                T.dialogs.importSavegameError.text + ":<br><br>" + err
            );
        }
    }

    onBackButton() {
        this.app.platformWrapper.exitApp();
    }

    onEnter(payload) {
        // Start loading already
        const app = this.app;
        setTimeout(() => app.backgroundResourceLoader.getIngamePromise(), 10);

        this.dialogs = new HUDModalDialogs(null, this.app);
        const dialogsElement = document.body.querySelector(".modalDialogParent");
        this.dialogs.initializeToElement(dialogsElement);

        if (payload.loadError) {
            this.dialogs.showWarning(
                T.dialogs.gameLoadFailure.title,
                T.dialogs.gameLoadFailure.text + "<br><br>" + payload.loadError
            );
        }

        if (G_IS_DEV && globalConfig.debug.fastGameEnter) {
            const games = this.app.savegameMgr.getSavegamesMetaData();
            if (games.length > 0 && globalConfig.debug.resumeGameOnFastEnter) {
                this.resumeGame(games[0]);
            } else {
                this.onPlayButtonClicked();
            }
        }

        // Initialize video
        this.videoElement = this.htmlElement.querySelector("video");
        this.videoElement.playbackRate = 0.9;
        this.videoElement.addEventListener("canplay", () => {
            if (this.videoElement) {
                this.videoElement.classList.add("loaded");
            }
        });

        const clickHandling = {
            ".settingsButton": this.onSettingsButtonClicked,
            ".achievementsButton": this.onAchievementsButtonClicked,
            ".exitAppButton": this.onExitAppButtonClicked,
            ".editMods": this.onModsClicked,
        };

        for (const key in clickHandling) {
            const handler = clickHandling[key];
            const element = this.htmlElement.querySelector(key);
            if (element) {
                this.trackClicks(element, handler, { preventClick: true });
            }
        }

        this.renderMainMenu();
        this.renderSavegames();
        this.renderYandexAuth();

        if (shouldOfferYandexAuth(this.app)) {
            const signals = showYandexAuthOffer(this.app, this.dialogs);
            signals.login.add(() => this.renderYandexAuth());
        }
    }

    /**
     * Shows the "Sign in with Yandex ID" button below the continue/new-game
     * row - hidden entirely on platforms without sign-in support, or once
     * the player is already signed in (see yandex_auth.js for the separate
     * unsolicited offer modal, shown at most once per device).
     */
    renderYandexAuth() {
        const mount = this.htmlElement.querySelector(".yandexAuthMount");
        removeAllChildren(mount);

        if (!this.app.platformWrapper.getSupportsAuth() || this.app.platformWrapper.isAuthorized()) {
            return;
        }

        this.trackClicks(
            makeButton(mount, ["yandexAuthButton", "styledButton"], T.yandexAuth.loginButton),
            this.onYandexAuthButtonClicked
        );
    }

    async onYandexAuthButtonClicked() {
        await this.app.platformWrapper.requestAuth();
        this.renderYandexAuth();
    }

    renderMainMenu() {
        const buttonContainer = this.htmlElement.querySelector(".mainContainer .buttons");
        removeAllChildren(buttonContainer);

        const mainContainer = this.htmlElement.querySelector(".mainContainer");

        const outerDiv = makeDivElement(null, ["outer"], null);

        if (this.savedGames.length > 0) {
            // Continue game - card style, subtitle shows the most recently
            // played savegame's level (same "latest by lastUpdate" pick
            // onContinueButtonClicked itself resumes).
            const latest = this.latestSavegameMeta;
            const levelText = latest && latest.level
                ? T.mainMenu.savegameLevel.replace("<x>", "" + latest.level)
                : T.mainMenu.savegameLevelUnknown;
            this.trackClicks(
                makeButton(buttonContainer, ["continueButton", "styledButton", "menu-button", "continue-button"], `
                    <span class="title">${T.mainMenu.continue}</span>
                    <span class="subtitle">${levelText}</span>
                    <svg class="play-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>
                `),
                this.onContinueButtonClicked
            );

            // New game
            this.trackClicks(
                makeButton(
                    outerDiv,
                    ["newGameButton", "styledButton", "menu-button", "new-game-button"],
                    `<span class="title">${T.mainMenu.newGame}</span>`
                ),
                this.onPlayButtonClicked
            );

            // Import - stacked below New Game, sharing .outer's column and
            // height with it (see .outer/.newGameButton in main_menu.scss).
            this.trackClicks(
                makeButton(
                    outerDiv,
                    ["importButton", "styledButton", "menu-button"],
                    `<span class="title">${T.mainMenu.importSavegame}</span>`
                ),
                this.requestImportSavegame
            );
        } else {
            // New game - primary CTA when there's nothing to continue, so it
            // gets the same orange treatment as New Game rather than Continue's
            // neutral paper one.
            this.trackClicks(
                makeButton(
                    buttonContainer,
                    ["playButton", "styledButton", "menu-button", "new-game-button"],
                    `<span class="title">${T.mainMenu.play}</span>`
                ),
                this.onPlayButtonClicked
            );

            // Import - own full-width row below Play, with a hint since
            // there's nothing else here yet (see .importWrap in
            // main_menu.scss).
            const importWrap = makeDivElement(null, ["importWrap"], null);
            this.trackClicks(
                makeButton(
                    importWrap,
                    ["importButton", "styledButton", "menu-button"],
                    `<span class="title">${T.mainMenu.importSavegame}</span>`
                ),
                this.requestImportSavegame
            );
            makeDiv(importWrap, null, ["importHint"], T.mainMenu.importSavegameHint);
            buttonContainer.appendChild(importWrap);
        }

        mainContainer.setAttribute("data-savegames", String(this.savedGames.length));

        if (outerDiv.childElementCount > 0) {
            buttonContainer.appendChild(outerDiv);
        }
    }

    onBackButtonClicked() {
        this.renderMainMenu();
        this.renderSavegames();
    }

    onExitAppButtonClicked() {
        this.app.platformWrapper.exitApp();
    }

    get savedGames() {
        return this.app.savegameMgr.getSavegamesMetaData();
    }

    /**
     * The most recently played savegame's metadata - same pick
     * onContinueButtonClicked itself resumes - or null if there are none.
     * @returns {SavegameMetadata}
     */
    get latestSavegameMeta() {
        let latest = null;
        for (const meta of this.savedGames) {
            if (!latest || meta.lastUpdate > latest.lastUpdate) {
                latest = meta;
            }
        }
        return latest;
    }

    renderSavegames() {
        const oldContainer = this.htmlElement.querySelector(".mainContainer .savegames");
        if (oldContainer) {
            oldContainer.remove();
        }
        const games = this.savedGames;
        if (games.length > 0) {
            const parent = makeDiv(this.htmlElement.querySelector(".mainContainer .savegamesMount"), null, [
                "savegames",
            ]);

            for (let i = 0; i < games.length; ++i) {
                const elem = makeDiv(parent, null, ["savegame"]);

                makeDiv(
                    elem,
                    null,
                    ["playtime"],
                    formatSecondsToTimeAgo((new Date().getTime() - games[i].lastUpdate) / 1000.0)
                );

                makeDiv(
                    elem,
                    null,
                    ["level"],
                    games[i].level
                        ? T.mainMenu.savegameLevel.replace("<x>", "" + games[i].level)
                        : T.mainMenu.savegameLevelUnknown
                );

                const name = makeDiv(
                    elem,
                    null,
                    ["name"],
                    "<span>" + (games[i].name ? games[i].name : T.mainMenu.savegameUnnamed) + "</span>"
                );
                this.trackClicks(name, () => this.requestRenameSavegame(games[i]));

                const deleteButton = document.createElement("button");
                deleteButton.classList.add("styledButton", "deleteGame");
                deleteButton.setAttribute("aria-label", "Delete");
                elem.appendChild(deleteButton);

                const downloadButton = document.createElement("button");
                downloadButton.classList.add("styledButton", "downloadGame");
                downloadButton.setAttribute("aria-label", "Download");
                elem.appendChild(downloadButton);

                const renameButton = document.createElement("button");
                renameButton.classList.add("styledButton", "renameGame");
                renameButton.setAttribute("aria-label", "Rename Savegame");
                name.appendChild(renameButton);
                // consumeEvents: the button sits inside the now-clickable .name
                // div - without this, tapping the pencil would also bubble up
                // and fire the parent's rename handler a second time.
                this.trackClicks(renameButton, () => this.requestRenameSavegame(games[i]), {
                    consumeEvents: true,
                });

                const resumeButton = document.createElement("button");
                resumeButton.classList.add("styledButton", "resumeGame");
                resumeButton.setAttribute("aria-label", "Resumee");
                resumeButton.innerHTML =
                    '<svg class="play-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>';
                elem.appendChild(resumeButton);

                this.trackClicks(deleteButton, () => this.deleteGame(games[i]));
                this.trackClicks(downloadButton, () => this.downloadGame(games[i]));
                this.trackClicks(resumeButton, () => this.resumeGame(games[i]));
            }
        } else {
            const parent = makeDiv(
                this.htmlElement.querySelector(".mainContainer .savegamesMount"),
                null,
                ["savegamesNone"],
                T.mainMenu.noActiveSavegames
            );
        }
    }

    /**
     * @param {SavegameMetadata} game
     */
    requestRenameSavegame(game) {
        const regex = /^[a-zA-Z0-9_\- ]{1,20}$/;

        const nameInput = new FormElementInput({
            id: "nameInput",
            label: null,
            placeholder: "",
            defaultValue: game.name || "",
            validator: val => val.match(regex) && val.trim().length > 0,
        });
        const dialog = new DialogWithForm({
            app: this.app,
            title: T.dialogs.renameSavegame.title,
            desc: T.dialogs.renameSavegame.desc,
            formElements: [nameInput],
            buttons: ["cancel:bad:escape", "ok:good:enter"],
        });

        this.dialogs.internalShowDialog(dialog);

        // When confirmed, save the name
        dialog.buttonSignals.ok.add(() => {
            game.name = nameInput.getValue().trim();
            this.app.savegameMgr.writeAsync();
            this.renderSavegames();
        });
    }

    /**
     * @param {SavegameMetadata} game
     */
    resumeGame(game) {
        const savegame = this.app.savegameMgr.getSavegameById(game.internalId);
        savegame
            .readAsync()
            .then(() => this.checkForModDifferences(savegame))
            .then(() => {
                this.moveToState("InGameState", {
                    savegame,
                });
            })

            .catch(err => {
                this.dialogs.showWarning(
                    T.dialogs.gameLoadFailure.title,
                    T.dialogs.gameLoadFailure.text + "<br><br>" + err
                );
            });
    }

    /**
     * @param {Savegame} savegame
     */
    checkForModDifferences(savegame) {
        const difference = MODS.computeModDifference(savegame.currentData.mods);

        if (difference.missing.length === 0 && difference.extra.length === 0) {
            return Promise.resolve();
        }

        let dialogHtml = T.dialogs.modsDifference.desc;

        /**
         *
         * @param {import("../savegame/savegame_typedefs").SavegameStoredMods[0]} mod
         */
        function formatMod(mod) {
            return `
                <div class="dialogModsMod">
                    <div class="name">${mod.name}</div>
                    <div class="version">${T.mods.version} ${mod.version}</div>
                    <button class="website styledButton" onclick="window.open('${mod.website?.replace(
                        /"'/,
                        ""
                    )}')">${T.mods.modWebsite}
            </button>

                </div>
            `;
        }

        if (difference.missing.length > 0) {
            dialogHtml += "<h3>" + T.dialogs.modsDifference.missingMods + "</h3>";
            dialogHtml += difference.missing.map(formatMod).join("<br>");
        }

        if (difference.extra.length > 0) {
            dialogHtml += "<h3>" + T.dialogs.modsDifference.newMods + "</h3>";
            dialogHtml += difference.extra.map(formatMod).join("<br>");
        }

        const signals = this.dialogs.showWarning(T.dialogs.modsDifference.title, dialogHtml, [
            "cancel:good",
            "continue:bad",
        ]);

        return new /** @type {typeof Promise<void>} */ (Promise)(resolve => {
            signals.continue.add(resolve);
        });
    }

    /**
     * @param {SavegameMetadata} game
     */
    deleteGame(game) {
        const levelText = game.level
            ? T.mainMenu.savegameLevel.replace("<x>", "" + game.level)
            : T.mainMenu.savegameLevelUnknown;
        const signals = this.dialogs.showWarning(
            T.dialogs.confirmSavegameDelete.title,
            `
                <p>${T.dialogs.confirmSavegameDelete.desc}</p>
                <div class="saveInfo">
                    <svg class="saveInfoIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>
                    <span class="saveInfoText">&laquo;${game.name || T.mainMenu.savegameUnnamed}&raquo; &bull; ${levelText}</span>
                </div>
                <div class="warningNote">${T.dialogs.confirmSavegameDelete.warningNote}</div>
            `,
            ["cancel:good", "delete:bad:timeout"]
        );

        signals.delete.add(() => {
            this.app.savegameMgr.deleteSavegame(game).then(
                () => {
                    this.renderSavegames();
                    if (this.savedGames.length <= 0) this.renderMainMenu();
                },
                err => {
                    this.dialogs.showWarning(
                        T.dialogs.savegameDeletionError.title,
                        T.dialogs.savegameDeletionError.text + "<br><br>" + err
                    );
                }
            );
        });
    }

    /**
     * @param {SavegameMetadata} game
     */
    downloadGame(game) {
        const savegame = this.app.savegameMgr.getSavegameById(game.internalId);
        savegame.readAsync().then(() => {
            const filename = (game.name || "unnamed") + ".bin";
            savegame.storage.requestSaveFile(filename, savegame.currentData);
        });
    }

    onSettingsButtonClicked() {
        this.moveToState("SettingsState");
    }

    onAchievementsButtonClicked() {
        this.moveToState("AchievementsState");
    }

    onPlayButtonClicked() {
        const savegame = this.app.savegameMgr.createNewSavegame();

        this.moveToState("InGameState", {
            savegame,
        });
    }

    onModsClicked() {
        this.moveToState("ModsState", {
            backToStateId: "MainMenuState",
        });
    }

    onContinueButtonClicked() {
        let latestLastUpdate = 0;
        let latestInternalId;
        this.app.savegameMgr.currentData.savegames.forEach(saveGame => {
            if (saveGame.lastUpdate > latestLastUpdate) {
                latestLastUpdate = saveGame.lastUpdate;
                latestInternalId = saveGame.internalId;
            }
        });

        const savegame = this.app.savegameMgr.getSavegameById(latestInternalId);
        if (!savegame) {
            console.warn("No savegame to continue found:", this.app.savegameMgr.currentData.savegames);
            return;
        }

        savegame
            .readAsync()
            .then(() => this.checkForModDifferences(savegame))
            .then(() => {
                this.moveToState("InGameState", {
                    savegame,
                });
            });
    }

    onLeave() {
        this.dialogs.cleanup();
    }
}
