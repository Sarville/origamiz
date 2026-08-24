# TODO — Yandex Games web port

Porting shapez CE (currently Electron-only) to run in a plain browser for
Yandex Games. Each chunk is a separate session; see `sessions/` for detailed
logs.

## Decided

- **Licensing: staying GPL-3.0-or-later.** Decided 2026-08-24. Rewriting/optimizing
  functions does NOT remove GPL obligations on a derivative work — only a genuine
  clean-room reimplementation would, and that's a different, much bigger project,
  not a continuation of this fork. We publish our source and keep the license
  notices; that's compatible with a commercial release. No relicensing work needed.
- Rebranding (assets, name, all "shapez" references) and licensing are independent
  of the engineering chunks below — can happen in parallel, doesn't block them.

## Chunks

- [x] **Chunk 1 — Browser platform runtime.** Game boots and is playable in a
      plain browser, no Electron/`ipcRenderer` required. Done 2026-08-24, see
      `sessions/2026-08-24-2238-session.md`.
      Files: `src/js/platform/browser_fs_job.ts` (new), `src/js/platform/storage.ts`,
      `src/js/platform/wrapper.js`, `src/js/application.js`, `src/js/mods/modloader.ts`.
- [x] **Chunk 2a — Mobile touch baseline.** Touch didn't work at all (keyboard+mouse
      only). Done 2026-08-25, see `sessions/2026-08-25-0010-session.md`. Root causes
      were 3 bugs, not missing functionality: `IS_MOBILE` used Chromium-only
      `navigator.userAgentData` (crashes on Safari/Firefox mobile) instead of UA
      sniffing; global `touch-action: pan-x pan-y` fought the game's own touch
      handling on the canvas; a typo in `abortDragging()` set `currentlyDragging = true`
      instead of `false`. User-confirmed working on a real phone via `tailscale serve`.
      Files: `src/js/core/config.ts`, `src/css/common.scss`,
      `src/js/game/hud/parts/building_placer_logic.js`.
- [ ] **Chunk 2b — Mobile control redesign.** Touch now *works* but is rough — found
      during 2b testing, not yet fixed:
      - Tapping an empty tile after a drag tries to build a path from the *previous*
        drag's end tile to the new tap, instead of starting fresh. One bug fixed
        already (`abortDragging` typo, see 2a) but that alone may not fully explain
        it — needs live on-device touch-event tracing, not more blind code reading.
        (Hypothesis worth checking first: `camera.js` `onTouchEnd` reads
        `event.changedTouches[0]` without checking length, could throw and skip
        `upPostHandler.dispatch()` — meaning drag state never resets — but unconfirmed.)
      - No way to rotate or delete a building via touch — only keyboard R/Delete,
        no on-screen buttons at all.
      - Keybindings settings screen is desktop-only, ~3 screens of key bindings —
        meaningless on mobile as-is, needs a mobile-specific simplified UI.
      Start this chunk with live device debugging via the existing `tailscale serve`
      link (see Infra notes below), not more code archaeology.
- [ ] **Chunk 3 — Build system.** Add a `web` variant to `gulp/build_variants.js`
      (`standalone: false`), verify `gulp/tasks.js`/`gulp/html.js` produce a
      self-contained static bundle with no Electron-specific parts.
- [ ] **Chunk 4 — Yandex Games SDK.** `ysdk.features.LoadingAPI.ready()`, ads,
      `<script src="https://yandex.ru/games/sdk/v2">` in the web HTML template.
      TBD: verify IndexedDB works from inside Yandex's cross-origin iframe context
      (storage partitioning risk, not yet tested).

## Infra notes

- Dev server tailnet access: raw port exposure (e.g. `localwsl.tail404046.ts.net:3005`)
  is unreliable from at least one tested phone (WSL2 networking / NAT issue, only
  works when the phone routes via a Tailscale exit node). Fix: use
  `tailscale serve --bg --https=<port> <local-port>` instead (this project's other
  services already do this, see `tailscale serve status`) — routes through
  tailscaled's own HTTPS proxy instead of a raw exposed socket, works reliably
  without an exit node. Dev server is currently also reachable at
  `https://localwsl.tail404046.ts.net:8721/`.
