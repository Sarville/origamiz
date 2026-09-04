/**
 * The full list of achievements. Order here is only the default display
 * order (unlocked ones get sorted after locked ones by the UI) - it has no
 * gameplay meaning.
 *
 * `secret: true` means the achievement's name is always shown, but its real
 * description is replaced by a placeholder ("???") until it's unlocked - the
 * condition stays a surprise. Everything else always shows its full
 * description, whether unlocked yet or not.
 *
 * @typedef {Object} AchievementDef
 * @property {string} id
 * @property {boolean=} secret
 */

/** @type {Array<AchievementDef>} */
export const ACHIEVEMENTS = [
    { id: "blueprint100k" },
    { id: "play10h" },
    { id: "play1h" },
    { id: "blueprint1m" },
    { id: "richBuratino" },
    { id: "play20h" },
    { id: "throughputBp25" },
    { id: "throughputBp50" },
    { id: "place5000Wires" },
    { id: "placeBlueprint" },
    { id: "noBeltUpgradesUntilBp" },
    { id: "throughputLogo25" },
    { id: "throughputLogo50" },
    { id: "placeBp1000" },
    { id: "cutShape" },
    { id: "darkMode" },
    { id: "destroy1000" },
    { id: "throughputRocket10" },
    { id: "produceLogo" },
    { id: "level100" },
    { id: "unlockWires" },
    { id: "completeLvl26" },
    { id: "upgradesTier5" },
    { id: "level50" },
    { id: "upgradesTier8" },
    { id: "mam" },
    { id: "noInverseRotater" },
    { id: "openWires" },
    { id: "paintShape" },
    { id: "produceRocket" },
    { id: "rotateShape" },
    { id: "speedrunBp120" },
    { id: "speedrunBp60" },
    { id: "speedrunBp30" },
    { id: "throughputRocket20" },
    { id: "stackShape" },
    { id: "stack4Layers" },
    { id: "storeShape" },
    { id: "store100Unique" },
    { id: "trash1000" },
    { id: "belts10k" },
    { id: "freeplayLevel120s" },
    { id: "place1mBps" },
    { id: "store200k" },
    { id: "freeplayLevel30s" },
    { id: "freeplayLevel60s" },
    { id: "beltsLvl15" },
    { id: "bird" },
    { id: "lvl6NoBalancers" },
    { id: "lvl12NoDestroying" },
    { id: "lvl20NoDoublePainter" },
    { id: "noFactoryFreeplay" },
    { id: "lvl12NoTrash" },
    { id: "lvl7NoTunnels" },
    { id: "lvl12NoUpgrades" },
    { id: "lvl27NoWires" },
    { id: "rocketBeforeLogo" },
    { id: "scissors" },
    { id: "whoKnows" },
    { id: "msLogo" },

    // Secret: name is always visible, description is hidden until unlocked
    { id: "belt500Tiles", secret: true },
    { id: "logoBefore18", secret: true },
    { id: "mapMarkers15", secret: true },
    { id: "irrelevantShape", secret: true },
    { id: "notRocket", secret: true },
    { id: "stack5thLayer", secret: true },
];
