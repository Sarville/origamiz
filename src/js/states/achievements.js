import { TextualGameState } from "../core/textual_game_state";
import { ACHIEVEMENTS } from "../game/achievements/achievement_defs";
import { T } from "../translations";

export class AchievementsState extends TextualGameState {
    constructor() {
        super("AchievementsState");
    }

    getStateHeaderTitle() {
        return T.achievements.title;
    }

    getMainContentHTML() {
        const storage = this.app.achievements;

        const sorted = ACHIEVEMENTS.slice().sort((a, b) => {
            const unlockedA = storage.isUnlocked(a.id);
            const unlockedB = storage.isUnlocked(b.id);
            return unlockedA === unlockedB ? 0 : unlockedA ? -1 : 1;
        });

        const unlockedCount = ACHIEVEMENTS.reduce(
            (count, achievement) => count + (storage.isUnlocked(achievement.id) ? 1 : 0),
            0
        );

        const itemsHtml = sorted
            .map(achievement => {
                const unlocked = storage.isUnlocked(achievement.id);
                const def = T.achievements.list[achievement.id];
                const description =
                    achievement.secret && !unlocked ? T.achievements.hiddenDescription : def.description;

                return `
                    <div class="achievement ${unlocked ? "unlocked" : "locked"}">
                        <div class="badge"></div>
                        <div class="info">
                            <div class="name">${def.name}</div>
                            <div class="description">${description}</div>
                        </div>
                    </div>
                `;
            })
            .join("");

        return `
            <div class="achievementsState">
                <div class="stats">${T.achievements.unlockedOf
                    .replace("<x>", String(unlockedCount))
                    .replace("<y>", String(ACHIEVEMENTS.length))}</div>
                <div class="achievementsList">${itemsHtml}</div>
            </div>
        `;
    }
}
