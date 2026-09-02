import debug from "./config.local";

// Single place to rebrand the game's display name.
export const APP_NAME = "Origamiz";

// Single place to rebrand the publisher name shown in the UI (e.g. mobile footer).
export const BRAND_AUTHOR = "Sarville";

export const globalConfig = {
    // Size of a single tile in Pixels.
    tileSize: 32,
    halfTileSize: 16,

    // Which dpi the assets have
    assetsDpi: 192 / 32,
    assetsSharpness: 1.5,
    shapesSharpness: 1.3,

    // Production analytics
    statisticsGraphDpi: 2.5,
    statisticsGraphSlices: 100,
    analyticsSliceDurationSeconds: G_IS_DEV ? 1 : 10,

    // Map
    mapChunkSize: 16,
    chunkAggregateSize: 4,
    mapChunkOverviewMinZoom: 0.9,
    mapChunkWorldSize: null, // COMPUTED

    maxBeltShapeBundleSize: 20,

    // Belt speeds
    beltSpeedItemsPerSecond: 2,
    minerSpeedItemsPerSecond: 0, // COMPUTED

    defaultItemDiameter: 20,

    itemSpacingOnBelts: 0.63,

    undergroundBeltMaxTilesByTier: [5, 9],

    readerAnalyzeIntervalSeconds: 10,

    puzzleModeSpeed: 3,

    buildingSpeeds: {
        cutter: 1 / 4,
        cutterQuad: 1 / 4,
        rotator: 1 / 1,
        rotatorCCW: 1 / 1,
        rotator180: 1 / 1,
        painter: 1 / 6,
        painterDouble: 1 / 8,
        painterQuad: 1 / 2,
        mixer: 1 / 5,
        stacker: 1 / 8,
    },

    warmupTimeSecondsFast: 0.25,
    warmupTimeSecondsRegular: 0.25,

    smoothing: {
        smoothMainCanvas: true,
        quality: "low" as ImageSmoothingQuality, // Low is CRUCIAL for mobile performance!
    },

    debug,
};

// navigator.userAgentData (Client Hints) is Chromium-only and undefined on
// Safari/Firefox, where ".mobile" would throw at module load. UA sniffing is
// less "modern" but actually works everywhere.
export const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
export const SUPPORT_TOUCH = IS_MOBILE;

// Automatic calculations
globalConfig.minerSpeedItemsPerSecond = globalConfig.beltSpeedItemsPerSecond / 5;

globalConfig.mapChunkWorldSize = globalConfig.mapChunkSize * globalConfig.tileSize;

// Dynamic calculations
if (globalConfig.debug.disableMapOverview) {
    globalConfig.mapChunkOverviewMinZoom = 0;
}

if (globalConfig.debug.fastGameEnter) {
    globalConfig.debug.noArtificialDelays = true;
}

if (G_IS_DEV && globalConfig.debug.noArtificialDelays) {
    globalConfig.warmupTimeSecondsFast = 0;
    globalConfig.warmupTimeSecondsRegular = 0;
}
