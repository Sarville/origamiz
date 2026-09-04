/* typehints:start */
import { Application } from "../application";
import { HUDModalDialogs } from "../game/hud/parts/modal_dialogs";
/* typehints:end */

import { T } from "../translations";

// Module-level, not persisted - just keeps the unsolicited offer from
// popping up again every time the player returns to the main menu within
// the same page load, on top of the persisted "declined" flag which keeps
// it from ever coming back across reloads (see platform requirement 1.2.1:
// never intrusive/repetitive).
let offeredThisSession = false;

/**
 * Whether the unsolicited sign-in offer (see showYandexAuthOffer) should be
 * shown right now - once per device until declined, and never once the
 * player is already signed in.
 * @param {Application} app
 * @returns {boolean}
 */
export function shouldOfferYandexAuth(app) {
    return (
        !offeredThisSession &&
        app.platformWrapper.getSupportsAuth() &&
        !app.platformWrapper.isAuthorized() &&
        !app.settings.hasDeclinedYandexAuthOffer()
    );
}

/**
 * Shows the sign-in benefits/disclaimer modal and wires up its two buttons.
 * This is only for the *unsolicited* offer (shouldOfferYandexAuth) - the
 * explicit "Sign in with Yandex ID" button (main_menu.js, settings_menu.js)
 * calls platformWrapper.requestAuth() directly instead, since clicking a
 * button clearly labeled that way is already the deliberate action platform
 * requirement 1.2.1 asks for, without needing this explanation first.
 * @param {Application} app
 * @param {HUDModalDialogs} dialogs
 * @returns The dialog's buttonSignals, in case the caller wants to react
 * once sign-in actually completes (e.g. to refresh a login button).
 */
export function showYandexAuthOffer(app, dialogs) {
    offeredThisSession = true;
    const signals = dialogs.showWarning(T.yandexAuth.offerTitle, T.yandexAuth.offerDesc, [
        "later:bad",
        "login:good",
    ]);
    signals.later.add(() => app.settings.setDeclinedYandexAuthOffer());
    signals.login.add(() => app.platformWrapper.requestAuth());
    return signals;
}
