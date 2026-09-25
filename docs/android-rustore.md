# Android (Capacitor) build for RuStore

Fourth build variant next to `web` / `yandex` / `vk`: `G_IS_ANDROID=true`. The static build (`build/`) is
bundled into an APK/AAB by Capacitor, so the game runs fully offline; only ads and purchases need the network.
Reference implementation: the sibling `flowit/Colorit` project (`docs/android-rustore.md`).

## Build
```bash
npm run build-android          # gulp build.android.full && cap sync android  (copies build/ into android/)
cd android
export JAVA_HOME=/home/user/jdk21 ANDROID_HOME=/home/user/Android/Sdk   # Gradle 8.14 / Capacitor 8 need JDK 21 (25 breaks)
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew bundleRelease        # AAB for RuStore (signed only if android/keystore.properties exists)
```
Real ad unit ids go in at build time (unset = Yandex demo units, which never pay):
`YAN_BANNER_ID=R-M-… YAN_INTERSTITIAL_ID=R-M-… YAN_REWARDED_ID=R-M-… npm run build-android`.

## Code map
- `src/js/platform/android_wrapper.js` - `PlatformWrapperImplAndroid`: RuStore Pay + Yandex Mobile Ads
  (banner on top, preloaded interstitial, rewarded). Interstitial scheduling is the shared
  `hud/parts/interstitial_ads.js`.
- `android/app/src/main/java/ru/sarville/origamiz/RuStorePayPlugin.java` - Capacitor bridge over RuStore Pay SDK 10.5.0
  (`getPurchases` / `purchase` / `acknowledge`). `MainActivity.java` - Pay deeplink handling + back button
  (forwarded to the game's Escape binding; swallowed in the main menu so the app never closes by accident).
- Platform-agnostic bits already existed: shop buttons, `disable_ads`, currency pack, ad flags.

## Before the first release (not automatable - all irreversible or account-bound)
1. **Package name** `ru.sarville.origamiz` (`capacitor.config.json`, `android/app/build.gradle`, Java package).
   Change it *before* the first RuStore upload - afterwards it is fixed forever. Not yet uploaded anywhere.
2. **Signing key**: `keytool -genkeypair -v -keystore origamiz-release.jks -alias origamiz -keyalg RSA -keysize 2048
   -validity 10000`, then `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`;
   `storeFile` relative to `android/`). Both are gitignored. **Back the .jks up outside the repo - losing it means
   no more updates.** Without `keystore.properties` release builds are silently UNSIGNED.
3. **RuStore Console**: create the app, put its "ID приложения" into `rustoreConsoleAppId` in
   `android/gradle.properties` (default `0`). Submit the *monetization application* as an ИП (self-employed
   can't use RuStore payments since 2026-02-01) - Pay SDK payments don't work until it's approved.
4. **Products** (Console → Monetization), ids letter-for-letter:
   - `disable_ads` - NON_CONSUMABLE
   - `currency_pack_10k` - CONSUMABLE (amount 10000, see `CURRENCY_PACK_AMOUNT`; keep price in sync with the
     Yandex/VK ones - RUB label comes from `T.ingame.currencyShop.*.price`)
5. **Ads** (Yandex РСЯ cabinet): add the app (RuStore link), create banner + interstitial + rewarded units, build
   with the `YAN_*_ID` env vars above.
6. Store material: launcher icon + splash (currently Capacitor defaults - `android/app/src/main/res/`), 512x512
   store icon, screenshots, age rating, privacy policy URL (ads + payments collect data;
   `setUserConsent(true)` is passed to the ads SDK unconditionally).
7. Bump `versionCode` in `android/app/build.gradle` on every upload.

## Behaviour notes / open checks (need a real device + test payments)
- Purchase order: grant first, acknowledge second. Consumable is acknowledged right after `purchase()`; an
  unacknowledged (`PENDING`) paid pack found at startup is credited + acknowledged by
  `consumeUnprocessedPurchases()` after the wallet hydrated.
- `disable_ads` is re-derived from `getPurchases` on every launch (survives reinstall); offline falls back to a
  local flag (`origamiz_ads_disabled` in localStorage).
- **Unverified**: which `status` a finished one-step purchase reports (code accepts PAID and CONFIRMED).
- **Unverified**: banking-app (SBP/SberPay) return via the `origamizpay://` deeplink.
- **Unverified**: banner `overlap:false` at the top on notched phones / in landscape.
- Savegames live in the WebView's IndexedDB: survive updates and restarts, wiped on uninstall (no cloud sync on
  Android; `getSupportsSavegameSync()` is false).
- Billing SDK (`billingclient`) is dead since 2026-08-01 - don't use `capacitor-rustore-billing`.
- Orientation is not locked in the manifest - decide after testing on a phone.
