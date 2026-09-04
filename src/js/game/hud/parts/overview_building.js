import { enumHubGoalRewards } from "../../tutorial_goals";

/**
 * Whether building placement (belt tap-routing, blueprint positioning) is
 * allowed to keep working while the map is zoomed out into map overview mode
 * (root.camera.getIsMapOverlayActive()) - the underlying placement logic
 * itself (HUDMobileControls' blueprint-follows-finger and belt
 * tap-continuation) doesn't care what zoom level it runs at, it was only
 * ever gated off during overview by a flat zoom check.
 *
 * Kept as its own module (rather than inlined as that flat check) so the
 * Shop's "Overview Building" purchase (reward_shop_overview_building) has a
 * single place to hook into instead of scattering conditions across
 * HUDMobileControls.
 */
export class OverviewBuildingPolicy {
    /**
     * @param {import("../../root").GameRoot} root
     */
    constructor(root) {
        this.root = root;
    }

    /**
     * @returns {boolean}
     */
    isAllowed() {
        return this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_shop_overview_building);
    }
}
