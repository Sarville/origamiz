/** @enum {string} */
export const enumColors = {
    red: "red",
    green: "green",
    blue: "blue",

    yellow: "yellow",
    purple: "purple",
    cyan: "cyan",

    white: "white",
    uncolored: "uncolored",
};
const c = enumColors;

/** @enum {string} */
export const enumColorToShortcode = {
    [c.red]: "r",
    [c.green]: "g",
    [c.blue]: "b",

    [c.yellow]: "y",
    [c.purple]: "p",
    [c.cyan]: "c",

    [c.white]: "w",
    [c.uncolored]: "u",
};

/** @enum {enumColors} */
export const enumShortcodeToColor = {};
for (const key in enumColorToShortcode) {
    enumShortcodeToColor[enumColorToShortcode[key]] = key;
}

/** @enum {string} */
export const enumColorsToHexCode = {
    [c.red]: "#fd837f",
    [c.green]: "#94fb7c",
    [c.blue]: "#86b6f3",

    // red + green
    [c.yellow]: "#fbf34d",

    // red + blue
    [c.purple]: "#e383f3",

    // blue + green
    [c.cyan]: "#36f8f3",

    // blue + green + red
    [c.white]: "#fdfbf3",

    [c.uncolored]: "#bbb9b1",
};

/** @enum {Object.<string, string>} */
export const enumColorMixingResults = {};

const bitfieldToColor = [
    /* 000 */ c.uncolored,
    /* 001 */ c.red,
    /* 010 */ c.green,
    /* 011 */ c.yellow,
    /* 100 */ c.blue,
    /* 101 */ c.purple,
    /* 110 */ c.cyan,
    /* 111 */ c.white,
];
for (let i = 0; i < 1 << 3; ++i) {
    enumColorMixingResults[bitfieldToColor[i]] = {};
    for (let j = 0; j < 1 << 3; ++j) {
        enumColorMixingResults[bitfieldToColor[i]][bitfieldToColor[j]] = bitfieldToColor[i | j];
    }
}
