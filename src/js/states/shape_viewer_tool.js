import { TextualGameState } from "../core/textual_game_state";
import { enumColorToShortcode } from "../game/colors";
import { enumSubShapeToShortcode, ShapeDefinition } from "../game/shape_definition";
import { T } from "../translations";

const DEFAULT_KEY = "CuCuCuCu";

/**
 * Builds a random (but valid) shape short key - shared with the compact
 * generator embedded in the marker-creation dialog (see waypoints.js's
 * showShapeKeyGeneratorDialog), so both places produce shapes the same way.
 * @returns {string}
 */
export function generateRandomShapeKey() {
    const shapeCodes = Object.values(enumSubShapeToShortcode);
    const colorCodes = Object.values(enumColorToShortcode);
    const layers = 1 + Math.floor(Math.random() * 4);
    const result = [];

    for (let layer = 0; layer < layers; ++layer) {
        let layerKey = "";
        let hasShape = false;
        for (let quadrant = 0; quadrant < 4; ++quadrant) {
            if (Math.random() < 0.25) {
                layerKey += "--";
            } else {
                hasShape = true;
                layerKey += shapeCodes[Math.floor(Math.random() * shapeCodes.length)];
                layerKey += colorCodes[Math.floor(Math.random() * colorCodes.length)];
            }
        }
        if (!hasShape) {
            layerKey = "Cu" + layerKey.slice(2);
        }
        result.push(layerKey);
    }

    return result.join(":");
}

export class ShapeViewerToolState extends TextualGameState {
    constructor() {
        super("ShapeViewerToolState");
    }

    getStateHeaderTitle() {
        return T.shapeViewerTool.title;
    }

    getMainContentHTML() {
        return `
            <div class="shapeViewerTool">
                <p class="description">${T.shapeViewerTool.description}</p>
                <label class="keyLabel" for="shapeViewerToolKey">${T.shapeViewerTool.shortKey}</label>
                <div class="keyControls">
                    <input id="shapeViewerToolKey" class="shapeKeyInput" value="${DEFAULT_KEY}" spellcheck="false" autocomplete="off">
                </div>
                <p class="error hidden"></p>
                <div class="actions">
                    <button class="styledButton previewButton">${T.shapeViewerTool.preview}</button>
                    <button class="styledButton copyButton">${T.shapeViewerTool.copy}</button>
                    <button class="styledButton randomButton">${T.shapeViewerTool.randomize}</button>
                    <button class="styledButton exportButton">${T.shapeViewerTool.export}</button>
                </div>
                <div class="previewArea"></div>
                <div class="instructions">${T.shapeViewerTool.instructions}</div>
            </div>
        `;
    }

    onEnter() {
        this.keyInput = this.htmlElement.querySelector(".shapeKeyInput");
        this.previewArea = this.htmlElement.querySelector(".previewArea");
        this.errorElement = this.htmlElement.querySelector(".error");

        this.trackClicks(this.htmlElement.querySelector(".previewButton"), this.renderCurrentKey);
        this.trackClicks(this.htmlElement.querySelector(".randomButton"), this.randomize);
        this.trackClicks(this.htmlElement.querySelector(".copyButton"), this.copyKey);
        this.trackClicks(this.htmlElement.querySelector(".exportButton"), this.exportPng);

        for (const button of this.htmlElement.querySelectorAll(".instructions .exampleKey")) {
            this.trackClicks(button, () => {
                this.keyInput.value = button.dataset.key;
                this.renderCurrentKey();
                this.previewArea.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }

        this.keyInput.addEventListener("input", () => this.renderCurrentKey());
        this.keyInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                this.renderCurrentKey();
            }
        });

        this.renderCurrentKey();
    }

    renderCurrentKey() {
        const key = this.keyInput.value.trim();
        if (!ShapeDefinition.isValidShortKey(key)) {
            this.currentDefinition = null;
            this.previewArea.replaceChildren();
            this.errorElement.textContent = T.shapeViewerTool.invalid;
            this.errorElement.classList.remove("hidden");
            return;
        }

        this.currentDefinition = ShapeDefinition.fromShortKey(key);
        this.previewArea.replaceChildren(this.currentDefinition.generateAsCanvas(360));
        this.errorElement.classList.add("hidden");
    }

    randomize() {
        this.keyInput.value = generateRandomShapeKey();
        this.renderCurrentKey();
    }

    copyKey() {
        if (this.currentDefinition) {
            navigator.clipboard.writeText(this.keyInput.value.trim());
        }
    }

    exportPng() {
        const canvas = this.previewArea.querySelector("canvas");
        if (!canvas) {
            return;
        }
        const link = document.createElement("a");
        link.download = "origamiz-shape.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    getDefaultPreviousState() {
        return "SettingsState";
    }
}
