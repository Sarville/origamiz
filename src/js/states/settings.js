import { THIRDPARTY_URLS } from "../core/config";

// TODO: privacyPolicy currently points at tobspr's own policy, hidden until
// Origamiz has its own. See config.ts.
const SHOW_PRIVACY_LINK = false;
import { TextualGameState } from "../core/textual_game_state";
import { enumCategories } from "../profile/application_settings";
import { T } from "../translations";

export class SettingsState extends TextualGameState {
    constructor() {
        super("SettingsState");
    }

    getStateHeaderTitle() {
        return T.settings.title;
    }

    getMainContentHTML() {
        return `

        <div class="sidebar">
            ${this.getCategoryButtonsHtml()}



            ${
                this.app.platformWrapper.getSupportsKeyboard()
                    ? `
            <button class="styledButton categoryButton editKeybindings">
            ${T.keybindings.title}
            </button>`
                    : ""
            }

            <button class="styledButton categoryButton manageMods">
            ${T.mods.title}
            </button>


            <div class="other">
                <button class="styledButton about">${T.about.title}</button>
                ${SHOW_PRIVACY_LINK ? `<button class="styledButton privacy">Privacy Policy</button>` : ""}
            </div>
        </div>

        <div class="categoryContainer">
            ${this.getSettingsHtml()}
        </div>

        `;
    }

    getCategoryButtonsHtml() {
        return Object.keys(enumCategories)
            .map(key => enumCategories[key])
            .map(
                category =>
                    `
                    <button class="styledButton categoryButton" data-category-btn="${category}">
                        ${T.settings.categories[category]}
                    </button>
                    `
            )
            .join("");
    }

    getSettingsHtml() {
        const categoriesHTML = {};

        Object.keys(enumCategories).forEach(key => {
            const catName = enumCategories[key];
            categoriesHTML[catName] = `<div class="category" data-category="${catName}">`;
        });

        for (let i = 0; i < this.app.settings.settingHandles.length; ++i) {
            const setting = this.app.settings.settingHandles[i];
            if (!setting.categoryId) {
                continue;
            }

            categoriesHTML[setting.categoryId] += setting.getHtml(this.app);
        }

        return Object.keys(categoriesHTML)
            .map(k => categoriesHTML[k] + "</div>")
            .join("");
    }

    onEnter(payload) {
        this.trackClicks(this.htmlElement.querySelector(".about"), this.onAboutClicked, {
            preventDefault: false,
        });

        const privacyButton = this.htmlElement.querySelector(".privacy");
        if (privacyButton) {
            this.trackClicks(privacyButton, this.onPrivacyClicked, { preventDefault: false });
        }

        const keybindingsButton = this.htmlElement.querySelector(".editKeybindings");

        if (keybindingsButton) {
            this.trackClicks(keybindingsButton, this.onKeybindingsClicked, { preventDefault: false });
        }

        this.initSettings();
        this.initCategoryButtons();

        this.htmlElement.querySelector(".category").classList.add("active");
        this.htmlElement.querySelector(".categoryButton").classList.add("active");

        const modsButton = this.htmlElement.querySelector(".manageMods");
        if (modsButton) {
            this.trackClicks(modsButton, this.onModsClicked, { preventDefault: false });
        }
    }

    setActiveCategory(category) {
        const previousCategory = this.htmlElement.querySelector(".category.active");
        const previousCategoryButton = this.htmlElement.querySelector(".categoryButton.active");

        if (previousCategory.getAttribute("data-category") == category) {
            return;
        }

        previousCategory.classList.remove("active");
        previousCategoryButton.classList.remove("active");

        const newCategory = this.htmlElement.querySelector("[data-category='" + category + "']");
        const newCategoryButton = this.htmlElement.querySelector("[data-category-btn='" + category + "']");

        newCategory.classList.add("active");
        newCategoryButton.classList.add("active");
    }

    initSettings() {
        this.app.settings.settingHandles.forEach(setting => {
            if (!setting.categoryId) {
                return;
            }

            /** @type {HTMLElement} */
            const element = this.htmlElement.querySelector("[data-setting='" + setting.id + "']");
            setting.bind(this.app, element, this.dialogs);
            setting.syncValueToElement();
            this.trackClicks(
                element,
                () => {
                    setting.modify();
                },
                { preventDefault: false }
            );
        });
    }

    initCategoryButtons() {
        Object.keys(enumCategories).forEach(key => {
            const category = enumCategories[key];
            const button = this.htmlElement.querySelector("[data-category-btn='" + category + "']");
            this.trackClicks(
                button,
                () => {
                    this.setActiveCategory(category);
                },
                { preventDefault: false }
            );
        });
    }

    onAboutClicked() {
        this.moveToStateAddGoBack("AboutState");
    }

    onPrivacyClicked() {
        this.app.platformWrapper.openExternalLink(THIRDPARTY_URLS.privacyPolicy);
    }

    onKeybindingsClicked() {
        this.moveToStateAddGoBack("KeybindingsState");
    }

    onModsClicked() {
        this.moveToStateAddGoBack("ModsState");
    }
}
