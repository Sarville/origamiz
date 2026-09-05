import { enumHubGoalRewards } from "../tutorial_goals";

export const finalGameShape = "RuCw--Cw:----Ru--";

export const REGULAR_MODE_LEVELS = [
    // 1
    // Circle
    {
        shape: "CuCuCuCu", // belts t1
        required: 30,
        reward: enumHubGoalRewards.reward_cutter_and_trash,
    },

    // 2
    // Cutter
    {
        shape: "----CuCu", //
        required: 40,
        reward: enumHubGoalRewards.no_reward,
    },

    // 3
    // Rectangle
    {
        shape: "RuRuRuRu", // miners t1
        required: 70,
        reward: enumHubGoalRewards.reward_balancer,
    },

    // 4
    {
        shape: "RuRu----", // processors t2
        required: 70,
        reward: enumHubGoalRewards.reward_rotator,
    },

    // 5
    // Rotator
    {
        shape: "Cu----Cu", // belts t2
        required: 170,
        reward: enumHubGoalRewards.reward_tunnel,
    },

    // 6
    {
        shape: "Cu------", // miners t2
        required: 270,
        reward: enumHubGoalRewards.reward_painter,
    },

    // 7
    // Painter
    {
        shape: "CrCrCrCr", // unused
        required: 300,
        reward: enumHubGoalRewards.no_reward,
    },
    // 8
    {
        shape: "RbRb----", // painter t2
        required: 480,
        reward: enumHubGoalRewards.reward_mixer,
    },
    // 9
    // Mixing (purple) - also opens Research Tier 1 (see generateResearch() in regular.js)
    {
        shape: "CpCpCpCp", // belts t3
        required: 600,
        reward: enumHubGoalRewards.reward_research,
    },

    // 10
    // STACKER: Star shape + cyan
    {
        shape: "ScScScSc", // miners t3
        required: 800,
        reward: enumHubGoalRewards.reward_stacker,
    },

    // 11
    {
        shape: "CgScScCg", // processors t3
        required: 1000,
        reward: enumHubGoalRewards.no_reward,
    },

    // 12
    {
        shape: "CbCbCbRb:CwCwCwCw",
        required: 1000,
        reward: enumHubGoalRewards.no_reward,
    },
    // 13
    // Blueprints are no longer a free level reward - this just grants a
    // currency head start toward buying them in the Shop (see
    // generateShopItems()'s "blueprints" item, gated to minLevel: 13, in
    // regular.js).
    {
        shape: "RpRpRpRp:CwCwCwCw", // painting t3
        required: 3800,
        reward: enumHubGoalRewards.reward_blueprints_shop_unlock,
        currencyBonus: 1000,
    },

    // 14
    // Belt reader
    {
        shape: "--Cg----:--Cr----", // unused
        required: 8, // Per second!
        reward: enumHubGoalRewards.reward_belt_reader,
        throughputOnly: true,
    },

    // 15
    // Storage
    {
        shape: "SrSrSrSr:CyCyCyCy", // unused
        required: 10000,
        reward: enumHubGoalRewards.reward_storage,
    },

    // 16
    // Also opens Research Tier 2 (see generateResearch() in regular.js)
    {
        shape: "SrSrSrSr:CyCyCyCy:SwSwSwSw", // belts t4 (two variants)
        required: 6000,
        reward: enumHubGoalRewards.reward_research_t2,
    },

    // 17
    {
        shape: "CbRbRbCb:CwCwCwCw:WbWbWbWb", // miner t4 (two variants)
        required: 20000,
        reward: enumHubGoalRewards.no_reward,
    },

    // 18
    {
        shape: "Sg----Sg:CgCgCgCg:--CyCy--", // unused
        required: 20000,
        reward: enumHubGoalRewards.no_reward,
    },

    // 19
    {
        shape: "CpRpCp--:SwSwSwSw",
        required: 25000,
        reward: enumHubGoalRewards.no_reward,
    },

    // 20
    // WIRES
    {
        shape: finalGameShape,
        required: 25000,
        reward: enumHubGoalRewards.reward_wires_painter_and_levers,
    },

    // 21
    // Filter
    {
        shape: "CrCwCrCw:CwCrCwCr:CrCwCrCw:CwCrCwCr",
        required: 25000,
        reward: enumHubGoalRewards.reward_filter,
    },

    // 22
    // Constant signal
    {
        shape: "Cg----Cr:Cw----Cw:Sy------:Cy----Cy",
        required: 25000,
        reward: enumHubGoalRewards.reward_constant_signal,
    },

    // 23
    // Display
    {
        shape: "CcSyCcSy:SyCcSyCc:CcSyCcSy",
        required: 25000,
        reward: enumHubGoalRewards.reward_display,
    },

    // 24 Logic gates
    {
        shape: "CcRcCcRc:RwCwRwCw:Sr--Sw--:CyCyCyCy",
        required: 25000,
        reward: enumHubGoalRewards.reward_logic_gates,
    },

    // 25 Virtual Processing
    {
        shape: "Rg--Rg--:CwRwCwRw:--Rg--Rg",
        required: 25000,
        reward: enumHubGoalRewards.reward_virtual_processing,
    },

    // 26 Freeplay
    {
        shape: "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw",
        required: 50000,
        reward: enumHubGoalRewards.reward_freeplay,
    },
];
