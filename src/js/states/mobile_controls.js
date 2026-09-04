import { TextualGameState } from "../core/textual_game_state";
import { T } from "../translations";

/**
 * Static reference screen for mobile touch controls - the mobile equivalent
 * of KeybindingsState. Unlike keybindings, none of this is rebindable, so
 * the whole thing is just static markup built from translations, no
 * onEnter wiring beyond the inherited back button.
 */
export class MobileControlsState extends TextualGameState {
    constructor() {
        super("MobileControlsState");
    }

    getStateHeaderTitle() {
        return T.mobileControls.title;
    }

    getMainContentHTML() {
        const sections = T.mobileControls.sections;
        const sectionsHTML = Object.keys(sections)
            .map(
                key => `
                <div class="section">
                    <strong class="sectionTitle">${sections[key].title}</strong>
                    <span class="sectionDesc">${sections[key].desc}</span>
                </div>
            `
            )
            .join("");

        const icons = T.mobileControls.icons;
        const iconsHTML = Object.keys(icons)
            .map(
                key => `
                <div class="iconEntry">
                    <span class="iconDesc">${icons[key]}</span>
                    <span class="iconGlyph ${key}"></span>
                </div>
            `
            )
            .join("");

        return `
            <div class="sections">
                ${sectionsHTML}
            </div>

            <div class="iconsTitle">${T.mobileControls.iconsTitle}</div>
            <div class="icons">
                ${iconsHTML}
            </div>
        `;
    }

    getDefaultPreviousState() {
        return "SettingsState";
    }
}
