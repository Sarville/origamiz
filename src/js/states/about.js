import { TextualGameState } from "../core/textual_game_state";
import { T } from "../translations";

export class AboutState extends TextualGameState {
    constructor() {
        super("AboutState");
    }

    getStateHeaderTitle() {
        return T.about.title;
    }

    getMainContentHTML() {
        return `
            <div class="head">
                <img src="res/logo.png" alt="Origamiz Logo">
            </div>
            <div class="text">
            ${T.about.currentBody}
            </div>
        `;
    }

    getDefaultPreviousState() {
        return "SettingsState";
    }
}
