import { APP_NAME, BRAND_AUTHOR, globalConfig, THIRDPARTY_URLS } from "../core/config";

// TODO: tobspr's own community links, hidden until Origamiz has its own. See config.ts.
const SHOW_TOBSPR_SOCIAL_LINKS = false;
import { GameState } from "../core/game_state";
import { DialogWithForm } from "../core/modal_dialog_elements";
import { FormElementInput } from "../core/modal_dialog_forms";
import {
    formatSecondsToTimeAgo,
    makeButton,
    makeDiv,
    makeDivElement,
    removeAllChildren,
} from "../core/utils";
import { HUDModalDialogs } from "../game/hud/parts/modal_dialogs";
import { MODS } from "../mods/modloader";
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

                <div class="socialLinks">
                    ${
                        SHOW_TOBSPR_SOCIAL_LINKS
                            ? `
                    <a class="patreonLink boxLink" target="_blank">
                        <span class="thirdpartyLogo patreonLogo"></span>
                        <span class="label">Patreon</span>
                    </a>`
                            : ""
                    }

                    <a class="githubLink boxLink" target="_blank">
                        <span class="thirdpartyLogo githubLogo"></span>
                        <span class="label">GitHub</span>
                    </a>

                    ${
                        SHOW_TOBSPR_SOCIAL_LINKS
                            ? `
                    <a class="discordLink boxLink" target="_blank">
                        <span class="thirdpartyLogo discordLogo"></span>
                        <span class="label">Discord</span>
                    </a>

                    <a class="redditLink boxLink" target="_blank">
                        <span class="thirdpartyLogo redditLogo"></span>
                        <span class="label">Reddit</span>
                    </a>`
                            : ""
                    }
                </div>

                <div class="brandMark">
                    <span class="name">${BRAND_AUTHOR}</span>
                    <span class="sub">Games</span>
                </div>
            </div>
        `;
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
            ".redditLink": this.onRedditClicked,
            ".patreonLink": this.onPatreonLinkClicked,
            ".exitAppButton": this.onExitAppButtonClicked,
            ".discordLink": () => {
                this.app.platformWrapper.openExternalLink(THIRDPARTY_URLS.discord);
            },
            ".githubLink": () => {
                this.app.platformWrapper.openExternalLink(THIRDPARTY_URLS.github);
            },
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
    }

    renderMainMenu() {
        const buttonContainer = this.htmlElement.querySelector(".mainContainer .buttons");
        removeAllChildren(buttonContainer);

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
        }

        this.htmlElement
            .querySelector(".mainContainer")
            .setAttribute("data-savegames", String(this.savedGames.length));

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

    onRedditClicked() {
        this.app.platformWrapper.openExternalLink(THIRDPARTY_URLS.reddit);
    }

    onPatreonLinkClicked() {
        this.app.platformWrapper.openExternalLink(THIRDPARTY_URLS.patreon);
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
