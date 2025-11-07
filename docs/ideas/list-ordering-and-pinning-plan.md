## Lists Ordering & Pinning Plan

### Scope

- Switch stored list ordering to "pinned first, then most recently updated".
- Introduce persistent `pinned` metadata for todo lists with toggle support in the UI.

### Execution Flow (Plan → Review → Tests → Code → Tests)

1. **Plan**
   - Confirm migration, persistence, store, UI, and testing touchpoints.
   - Identify existing utilities to reuse (save queue, `updatedAt` handling, list sidebar rendering).
2. **Review Plan**
   - Walk through the detailed steps with the team before any implementation work begins.
   - Incorporate feedback or adjustments prior to writing tests.
3. **Tests (First Pass)**
   - Update storage/unit/e2e tests so they fail until pin + ordering logic exists.
   - Ensure mocks and fixtures understand the new `pinned` field.
4. **Code**
   - Add DB migration and ordering changes, extend IPC/types/store actions, wire UI pin toggle.
   - Keep changes incremental and reuse the existing save queue.
5. **Tests (Final Run)**
   - Run `npm run lint`, `npm run typecheck`, `npm test`.
   - Execute `codacy_cli_analyze` for each touched file.

### Additional Notes

- Order SQL should prefer `pinned DESC, COALESCE(updated_at, created_at) DESC`.
- Pin toggling must bump `updatedAt` for consistent recent ordering.
- Document behavior change (e.g., CHANGELOG) once implementation ships.

### UI Behavior

- Pin icon sits on the right edge of each list row inside the sidebar item container.
- Visibility rules:
  - Hidden by default on unpinned lists; fades in when the list row is hovered/focused.
  - Always visible on pinned lists.
- Interaction states (icon + hit target):
  - **Hover list (unpinned)**: grey pin icon with no background.
  - **Hover icon (unpinned)**: grey pin with subtle grey pill background to signal action.
  - **Pinned (idle/hover)**: grey pin in “locked” style (no hover affordance) with disabled cursor to show it’s active.
  - **Hover icon (pinned)**: grey pin with grey pill background and “remove pin” tooltip/icon variant.
- Clicking toggles pinned state; newly pinned list animates to top of the list collection; unpin returns it to recency ordering.
- Apply subtle opacity/transition on icon appearance and position changes for smoothness.

### Migration & Ordering

- Add `pinned` column to `lists` table (`INTEGER NOT NULL DEFAULT 0`).
- Guard alteration with `PRAGMA table_info(lists)` (match `todos` v4 migration pattern) to keep migration idempotent.
- No backfill required; default covers all existing rows.
- Update `loadListsIndex` query to order by `pinned DESC, COALESCE(updated_at, created_at) DESC`.
- Update upsert in `saveListsIndex` to include `pinned`.

### Contracts & Types

- Extend `ListsIndexV2` (main and renderer) with optional `pinned?: boolean`.
- Update renderer storage normalization to coerce missing/invalid `pinned` to `false`.
- Ensure preload/IPC payloads and mocks carry the new field.

### Store & IPC Changes

- Add `toggleListPinned(id: string)` action in `useTodosStore` that flips `pinned`, bumps `updatedAt`, and relies on the save queue.
- Sort lists defensively in the store selector (`pinned` first, then recency) to match DB ordering even before persistence flushes.
- Log pin toggles via `debugLogger` (list id, new state).

### Tests-First Work

- DB tests: migration adds column (idempotent) and `loadListsIndex` respects ordering.
- Renderer unit tests: normalization defaults `pinned`, toggle action updates state/order and bumps `updatedAt`.
- E2E: pin/unpin moves list to top and persists after reload.
- Update shared fixtures/mocks (`testUtils/ui`, API mocks) to include `pinned` field.

### Observability & Rollout

- DB: log migration paths (added vs skipped) and pin save results.
- Renderer: log toggle interactions and resulting ordering counts.

### Quality Gates

- Follow standard repo gates: `npm run lint`, `npm run typecheck`, `npm test` (plus existing pre-commit hooks).
- After edits, run `codacy_cli_analyze` per modified file to satisfy workspace rules.
- Update `CHANGELOG.md` post-implementation to capture pinning + ordering change.
