/**
 * Whether building placement (belt tap-routing, blueprint positioning) is
 * allowed to keep working while the map is zoomed out into map overview mode
 * (root.camera.getIsMapOverlayActive()) - the underlying placement logic
 * itself (HUDMobileControls' blueprint-follows-finger and belt
 * tap-continuation) doesn't care what zoom level it runs at, it was only
 * ever gated off during overview by a flat zoom check.
 *
 * Kept as its own module (rather than inlined as that flat check) so a
 * future monetization gate - an unlockable upgrade, sped up by watching a
 * rewarded ad - has a single place to hook into instead of scattering
 * conditions across HUDMobileControls. See TODO.md's Yandex Games SDK
 * chunk for the actual monetization design, not done yet - isAllowed()
 * unconditionally returns true until that's built.
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
        return true;
    }
}
