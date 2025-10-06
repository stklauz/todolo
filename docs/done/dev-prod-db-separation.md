Dev/Prod DB Separation — Design and Implementation Plan

Goals
- Keep developer data fully separate from production user data by default.
- Ensure `npm start` runs with a dedicated Dev DB, while packaged apps use the Prod DB.
- Avoid data export/import for now; no mixing unless explicitly opted into.
- Keep the change minimal, maintainable, and easy to reason about.

Summary of Approach
- Use Electron’s `userData` path to control where the SQLite file is written.
- Use only `app.isPackaged` to detect development vs production. When not packaged, set `userData` to an app-specific dev directory (e.g., `Todolo-Dev` or `${app.getName()}-Dev`). Avoid `NODE_ENV` fallbacks.
- In production (packaged binaries), do not override `userData` (Electron defaults apply; e.g., `Todolo`).
 - No environment overrides; keep behavior simple and predictable.

Scope
- main process only: `src/main/main.ts` and `src/main/db.ts`.
- No renderer changes required.
- No schema or migration changes; same schema for dev and prod.

Behavior Matrix
- Development (not packaged; typically `npm start`): uses `userData` = `<appData>/Todolo-Dev` (or `${app.getName()}-Dev`) → DB at `todolo.db` in that folder.
- Production (packaged app; `npm run package` output): uses normal Electron `userData` (e.g., `<appData>/Todolo`) → DB at `todolo.db` there.
- Separation guarantee: As long as Dev and Prod `userData` resolve to different directories, the apps operate on different SQLite files. The exact directory names are less important than their distinctness.

Implementation Details
1) userData path separation (main process)
   - File: `src/main/main.ts`
   - Change: Early during main startup, when `!app.isPackaged`, set `app.setPath('userData', <appData>/${app.getName()}-Dev)` (or `Todolo-Dev` if the name isn’t stable in dev).
   - Ordering: Invoke `app.setPath('userData', ...)` as early as possible, before any module might compute or use `app.getPath('userData')`.
   - Rationale: All storage is keyed under `userData`. This transparently switches the SQLite file location with no app code changes elsewhere.

2) Database path resolution (main process)
   - File: `src/main/db.ts`
   - `getDbPath()` returns `path.join(app.getPath('userData'), 'todolo.db')`.
   - Ensure destination directory exists via `fs.mkdirSync(..., { recursive: true })`.
   - WAL note: SQLite WAL mode creates `*.db-wal` and `*.db-shm` files next to the DB; directories must be writable.

3) Keep production defaults untouched
   - Do not set `userData` in production code paths.
   - Packaged apps retain Electron defaults, ensuring they use the Prod DB location.
   - Log `userData` path at startup for both Dev and Prod for transparency.

4) No data mixing policy
   - We do not auto-share or auto-migrate data between Dev and Prod.
   - If at some point we need to test with Prod data in Dev, we can temporarily set an env var (e.g., `TODOLO_SHARE_DB_WITH_DEV=1`) or point to a path. This is not enabled by default.

Changes Summary (minimal diffs)
- `src/main/main.ts`
  - Replace the current logic that forces dev to share the Prod `userData` path with logic that uses a Dev-specific directory keyed by `!app.isPackaged`.
  - Place this before any code that could touch `userData`.
  - Example:
    - if (!app.isPackaged) {
      -   const devUserData = path.join(app.getPath('appData'), `${app.getName()}-Dev`);
      -   app.setPath('userData', devUserData);
      -   console.log(`[STORAGE] userData path (dev) -> ${devUserData}`);
      - } else {
      -   console.log(`[STORAGE] userData path (prod) -> ${app.getPath('userData')}`);
      - }

- `src/main/db.ts`
  - `getDbPath()` returns `path.join(app.getPath('userData'), 'todolo.db')` with directory creation. No env overrides.

Developer UX
- Zero additional steps: `npm start` uses the Dev DB; packaged apps use the Prod DB.
- First run expectations:
   - Dev starts with a fresh, empty DB by default under the Dev `userData` path. This is intentional; there is no automatic migration from Prod.
   - Prod maintains its own DB under the Prod `userData` path; it does not read Dev data.

Validation Plan
- Local dev
  - Start with a clean environment and run `npm start`.
  - Observe console logs: `[STORAGE] userData path (dev) -> .../Todolo-Dev` and `[DB] Database path: .../todolo.db`.
  - Add some todos; quit the app; relaunch `npm start` and verify todos persist.

- Ensure prod keeps separate data
  - Build/package the app with `npm run package`.
  - Install/run the packaged app; add different todos.
  - Verify the Dev app (`npm start`) shows only Dev data and the packaged app shows only Prod data.

- Verify WAL artifacts appear next to the DB (`todolo.db-wal`, `todolo.db-shm`) in the chosen directory.

Risks and Mitigations
- Existing Dev sessions currently writing to the Prod DB:
  - After change, new Dev runs will no longer see those Prod todos. This is expected and desired. If needed, a one-off copy of `todolo.db` can be manually performed by a developer.
 - Platform permissions: Paths under `userData` are user-writable by default; avoid changing them.

Acceptance Criteria
- `npm start` (not packaged) uses a distinct DB file under a Dev-only `userData` path, preserving todo state across hot reloads and restarts.
- Packaged apps use their own Prod DB path and do not read or modify Dev data.
- No code changes required in renderer; all data access continues to work.
- `app.isPackaged` is the only switch for separation; `NODE_ENV` does not affect DB selection.

Follow-up (optional, later)
- “Backup dev DB on launch” in development mode.
- A simple JSON export/import command to move data between Dev and Prod manually when needed.
- Add a brief README note for developers explaining how to manually copy `todolo.db` between `Todolo` and `Todolo-Dev` if they want to bootstrap dev with prod data.
 - Update README with a concise “Storage and Environments” section documenting default Dev/Prod locations, first-run expectations, and how to opt into overrides for testing.
