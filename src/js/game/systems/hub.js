import { globalConfig } from "../../core/config";
import { smoothenDpi } from "../../core/dpi_manager";
import { DrawParameters } from "../../core/draw_parameters";
import { drawSpriteClipped } from "../../core/draw_utils";
import { Loader } from "../../core/loader";
import { Rectangle } from "../../core/rectangle";
import { ORIGINAL_SPRITE_SCALE } from "../../core/sprites";
import { formatBigNumber } from "../../core/utils";
import { T } from "../../translations";
import { HubComponent } from "../components/hub";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";

const HUB_SIZE_TILES = 4;
const HUB_SIZE_PIXELS = HUB_SIZE_TILES * globalConfig.tileSize;

export class HubSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [HubComponent]);
    }

    /**
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        for (let i = 0; i < this.allEntities.length; ++i) {
            this.drawEntity(parameters, this.allEntities[i]);
        }
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            // Set hub goal
            const entity = this.allEntities[i];
            const pinsComp = entity.components.WiredPins;
            pinsComp.slots[0].value = this.root.shapeDefinitionMgr.getShapeItemFromDefinition(
                this.root.hubGoals.currentGoal.definition
            );
        }
    }
    /**
     *
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} w
     * @param {number} h
     * @param {number} dpi
     */
    redrawHubBaseTexture(canvas, context, w, h, dpi) {
        // This method is quite ugly, please ignore it!

        context.scale(dpi, dpi);

        const parameters = new DrawParameters({
            context,
            visibleRect: new Rectangle(0, 0, w, h),
            desiredAtlasScale: ORIGINAL_SPRITE_SCALE,
            zoomLevel: dpi * 0.75,
            root: this.root,
        });

        context.clearRect(0, 0, w, h);

        if (this.root.hubGoals.isEndOfDemoReached()) {
            // End of demo
            context.font = "bold 12px GameFont";
            context.fillStyle = "#fd0752";
            context.textAlign = "center";
            context.fillText(T.buildings.hub.endOfDemo.toUpperCase(), w / 2, h / 2 + 6);
            context.textAlign = "left";

            return;
        }

        const goals = this.root.hubGoals.currentGoal;
        const definition = goals.definition;

        // Layout per the user's reference mockup: goal cluster fills the top-right
        // corner (big, reaching almost down to the roof); the level chip sits as an
        // opaque red seal badge centered ON the roof itself (it doesn't need clear
        // background - it's a solid-color badge, not transparent text, so it reads
        // fine over the paper-fold pattern); the reward name centers in the leftover
        // rectangle between the left/top border and the goal cluster/roof, wrapping to
        // a second line if it doesn't fit on one.
        // (the roof was shifted down 40px this session so there's a clear band above
        // it at all - see buildings/hub.png's session-log entry).

        // Goal cluster: shape icon + delivered/required (or throughput), top-right.
        const goalCenterX = 104;
        definition.drawCentered(goalCenterX, 14, parameters, 22);

        context.textAlign = "center";
        if (goals.throughputOnly) {
            const rateText = T.ingame.statistics.shapesDisplayUnits.second.replace(
                "<shapes>",
                formatBigNumber(goals.required)
            );

            context.font = "bold 7px GameFont";
            context.fillStyle = "#64666e";
            context.fillText(rateText, goalCenterX, 28);
        } else {
            const delivered = this.root.hubGoals.getCurrentGoalDelivered();
            context.font = "bold 7px GameFont";
            context.fillStyle = "#64666e";
            context.fillText(formatBigNumber(delivered) + " / " + formatBigNumber(goals.required), goalCenterX, 28);
        }

        // Level chip: red rounded seal badge, centered on the roof.
        const chipX0 = 50;
        const chipY0 = 58;
        const chipX1 = 78;
        const chipY1 = 78;
        const chipR = 4;
        context.fillStyle = "#db2b13";
        context.beginPath();
        context.moveTo(chipX0 + chipR, chipY0);
        context.lineTo(chipX1 - chipR, chipY0);
        context.quadraticCurveTo(chipX1, chipY0, chipX1, chipY0 + chipR);
        context.lineTo(chipX1, chipY1 - chipR);
        context.quadraticCurveTo(chipX1, chipY1, chipX1 - chipR, chipY1);
        context.lineTo(chipX0 + chipR, chipY1);
        context.quadraticCurveTo(chipX0, chipY1, chipX0, chipY1 - chipR);
        context.lineTo(chipX0, chipY0 + chipR);
        context.quadraticCurveTo(chipX0, chipY0, chipX0 + chipR, chipY0);
        context.closePath();
        context.fill();

        const chipCenterX = (chipX0 + chipX1) / 2;
        context.textAlign = "center";
        context.fillStyle = "#fff";
        context.font = "bold 4px GameFont";
        context.fillText(T.buildings.hub.levelShortcut, chipCenterX, chipY0 + 7);

        context.font = "bold 11px GameFont";
        context.fillText("" + this.root.hubGoals.level, chipCenterX, chipY0 + 18);

        // Next unlock: red ink-seal name, centered in the leftover rectangle between
        // the left/top border and the goal cluster/roof - word-wraps to a 2nd line if
        // it doesn't fit on one.
        const rewardText = T.storyRewards[goals.reward].title.toUpperCase();
        const nameCenterX = 46;
        const nameMaxWidth = 78;
        context.fillStyle = "#db2b13";
        context.textAlign = "center";

        context.font = "bold 9px GameFont";
        if (context.measureText(rewardText).width <= nameMaxWidth) {
            context.fillText(rewardText, nameCenterX, 21);
        } else {
            const words = rewardText.split(" ");
            let line1 = words[0] || "";
            let i = 1;
            while (i < words.length && context.measureText(line1 + " " + words[i]).width <= nameMaxWidth) {
                line1 += " " + words[i];
                ++i;
            }
            const line2 = words.slice(i).join(" ");

            if (context.measureText(line1).width > nameMaxWidth || context.measureText(line2).width > nameMaxWidth) {
                context.font = "bold 7px GameFont";
            }
            context.fillText(line1, nameCenterX, 17);
            if (line2) {
                context.fillText(line2, nameCenterX, 26);
            }
        }

        context.textAlign = "left";
    }

    /**
     * @param {DrawParameters} parameters
     * @param {Entity} entity
     */
    drawEntity(parameters, entity) {
        const staticComp = entity.components.StaticMapEntity;
        if (!staticComp.shouldBeDrawn(parameters)) {
            return;
        }

        // Deliver count
        const delivered = this.root.hubGoals.getCurrentGoalDelivered();
        const deliveredText = "" + formatBigNumber(delivered);

        const dpi = smoothenDpi(globalConfig.shapesSharpness * parameters.zoomLevel);
        const canvas = parameters.root.buffers.getForKey({
            key: "hub",
            subKey: dpi + "/" + this.root.hubGoals.level + "/" + deliveredText,
            w: globalConfig.tileSize * 4,
            h: globalConfig.tileSize * 4,
            dpi,
            redrawMethod: this.redrawHubBaseTexture.bind(this),
        });

        const extrude = 2 * 4;
        drawSpriteClipped({
            parameters,
            sprite: canvas,
            x: staticComp.origin.x * globalConfig.tileSize - extrude,
            y: staticComp.origin.y * globalConfig.tileSize - extrude,
            w: HUB_SIZE_PIXELS + 2 * extrude,
            h: HUB_SIZE_PIXELS + 2 * extrude,
            originalW: HUB_SIZE_PIXELS * dpi,
            originalH: HUB_SIZE_PIXELS * dpi,
        });
    }
}
