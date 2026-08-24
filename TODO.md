# TODO — Yandex Games web port

Tracking the 3-chunk plan to port shapez CE (currently Electron-only) to run in a
plain browser for Yandex Games. Each chunk is a separate session; see `sessions/`
for detailed logs.

- [x] **Chunk 1 — Browser platform runtime.** Game boots and is playable in a
      plain browser, no Electron/`ipcRenderer` required. Done 2026-08-24, see
      `sessions/2026-08-24-2238-session.md`.
      Files: `src/js/platform/browser_fs_job.ts` (new), `src/js/platform/storage.ts`,
      `src/js/platform/wrapper.js`, `src/js/application.js`, `src/js/mods/modloader.ts`.
- [ ] **Chunk 2 — Build system.** Add a `web` variant to `gulp/build_variants.js`
      (`standalone: false`), verify `gulp/tasks.js`/`gulp/html.js` produce a
      self-contained static bundle with no Electron-specific parts.
- [ ] **Chunk 3 — Yandex Games SDK.** `ysdk.features.LoadingAPI.ready()`, ads,
      `<script src="https://yandex.ru/games/sdk/v2">` in the web HTML template.
      TBD: verify IndexedDB works from inside Yandex's cross-origin iframe context
      (storage partitioning risk, not yet tested).
