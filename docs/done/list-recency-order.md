# Lists Ordered by Last Update

## Problem Description

- Lists currently render in creation order, so a list edited a moment ago can sit far from the top, slowing task switching.
- `src/main/db.ts#loadListsIndex` issues `ORDER BY created_at ASC`, ignoring `updated_at`.
- Renderer normalization (`src/renderer/features/todos/utils/validation.ts`) preserves stale ordering after hydration, and store actions append new/updated lists without re-sorting.
- Many unit, integration, and e2e tests (for example `src/__tests__/storage.test.ts` and `src/renderer/__tests__/e2e/list-management.test.tsx`) hard-code expectations that align with creation order.
- Without a consistent “last update” policy, logs and diagnostics can’t easily explain list positioning.
- Existing utilities do not cover timestamp sorting: `src/renderer/utils/` only exposes `debug.ts`, while `src/renderer/features/todos/utils/` focuses on todo indentation/validation. A dedicated `listOrdering.ts` will not duplicate current helpers.
- Local mutations currently keep the array in append order. Actions such as `useTodosStore.addList()` (`lists: [...state.lists, newList]`), `renameList()` (array `map`), todo mutations, and `useListsManagement.duplicateList()` all preserve existing indices. With creation-order semantics that matched expectations, but once recency ordering becomes the invariant, each of those mutations would immediately undo the DB-sorted order unless the client re-applies a recency comparator after every change.
- Because `updatedAt` is optional today, fallback logic uses `createdAt`. Enforcing `updatedAt` as a required field (assigned on creation and every mutation) eliminates fallback complexity and aligns data with the planned ordering semantics.

## Proposed Solution

### Cycle 1 – Storage ordering

1. **Write test**
   - [x] Update `src/__tests__/storage.test.ts` (renderer IPC regression suite) with a case seeding three lists, each with distinct `updated_at`, and assert `loadListsIndex()` (imported from `src/main/db.ts` or mocked IPC) returns them newest-first.
   - [x] Update `src/renderer/features/todos/api/__tests__/storage.test.ts` (feature-level unit suite) to assert the IPC-facing `loadListsIndex` returns lists sorted by `updatedAt`.
2. **Code**
   - [x] Touch `src/main/db.ts`:

     ```typescript
     export function loadListsIndex(): ListsIndexV2 {
       const database = openDatabase();
       const lists = database
         .prepare(
           `SELECT id, name,
                   created_at as createdAt,
                   updated_at as updatedAt
            FROM lists
            ORDER BY COALESCE(updated_at, created_at) DESC,
                     created_at DESC`,
         )
         .all();
       console.log('[DB] Lists ordered by recency', {
         firstListId: lists[0]?.id,
         count: lists.length,
       });
       …
     }
     ```

   - [x] Mirror the same ordering in the seed query inside the empty-DB branch so initial data matches runtime ordering.
   - [NO NEED] ~~If legacy data can contain `updated_at IS NULL`, add a migration block in `src/main/db.ts` (e.g., within `applyV4Migration` or a new `applyV5Migration`) replacing nulls with `created_at`.~~

3. **Test**
   - Run `npm test -- src/__tests__/storage.test.ts` and `npm test -- src/renderer/features/todos/api/__tests__/storage.test.ts` (or `npm test -- storage`) to confirm both suites assert the new ordering.
4. **Review**

### Cycle 2 – Renderer normalization & store

1. **Write test**
   - [] Modify `src/renderer/features/todos/hooks/__tests__/useTodosState.test.tsx` so the addList expectation at lines 106–113 targets index `0`, and add a follow-up test that renaming or updating a list moves it to index `0`.
   - [] If not already covered, add store-level coverage in `src/renderer/feat[x] ures/todos/store/__tests__/` asserting `duplicateList`/`renameList` reorder lists.
2. **Code**
   - Add `src/renderer/features/todos/utils/listOrdering.ts`:

     ```typescript
     import type { TodoList } from '../types';
     import { debugLogger } from '../../../utils/debug';

     const timestampOrEpoch = (iso?: string) => {
       const parsed = Date.parse(iso ?? '');
       if (Number.isFinite(parsed)) return parsed;
       debugLogger.log('warn', 'Invalid list timestamp; using epoch fallback', {
         iso,
       });
       return 0;
     };

     export const sortListsByRecency = (lists: TodoList[]): TodoList[] => {
       const sorted = [...lists].sort((a, b) => {
         const aTime = timestampOrEpoch(a.updatedAt ?? a.createdAt);
         const bTime = timestampOrEpoch(b.updatedAt ?? b.createdAt);
         if (bTime !== aTime) return bTime - aTime;
         return a.name.localeCompare(b.name);
       });
       debugLogger.log('info', 'Lists sorted by recency', {
         firstListId: sorted[0]?.id,
         count: sorted.length,
       });
       return sorted;
     };
     ```

- Integrate the helper in:
  - [] `src/renderer/features/todos/api/storage.ts` so `loadListsIndex` returns lists sorted by recency even when IPC responses are mocked.
  - [x] `src/renderer/features/todos/hooks/useListsIndex.ts` after `normalizeList`.
  - [] `src/renderer/features/todos/store/useTodosStore.ts` for all list-mutating actions (`addList`, `renameList`, `duplicateList`, todo mutations, delete flows).
  - [] `src/renderer/features/todos/hooks/useListsManagement.ts` and `src/renderer/features/todos/hooks/useTodosPersistence.ts` (or equivalent) so any `setLists` call uses the sorter.
  - [] Component helpers such as `src/renderer/features/todos/components/TodoListHeader/components/ActionsMenu.tsx` where a full list array is replaced.

3. **Test**
   - Run `npm test -- useTodosState` (and any new store tests) to confirm the recency behavior and logging.
4. **Review**

### Cycle 3 – `updatedAt` enforcement, metadata hygiene & cross-cutting checks

1. **Write test**
   - Extend store tests (`useTodosState.test.tsx` or a new `useTodosStore` suite) to assert lists without `updatedAt` are rejected and that `duplicateList`/`renameList` emit it.
   - Update `src/renderer/features/todos/api/__tests__/storage.test.ts` and `src/__tests__/storage.test.ts` to simulate IPC payloads missing `updatedAt` and expect validation failures or defaults.
   - Add database-level coverage (if applicable) ensuring `src/main/db.ts#loadListsIndex` never returns rows without `updated_at`.
2. **Code**
   - Make `updatedAt` required everywhere:
     - `src/renderer/features/todos/api/storage.ts` (`ListsIndexV2` type, `loadListsIndex` sanitizer, `saveListsIndex` payload).
     - `src/renderer/features/todos/types.ts` and `src/renderer/features/todos/utils/validation.ts` (remove optionality, drop `createdAt` fallback).
     - `src/main/db.ts` (ensure `saveListsIndex` writes non-null `updated_at`; seed path assigns it).
   - Ensure all mutation paths set `updatedAt = new Date().toISOString()`:
     - Initial list creation in `useListsIndex`.
     - Store actions (`addList`, `duplicateList`, `renameList`, todo mutations, delete fallbacks).
     - `useListsManagement` helper flows.
   - Remove fallback logic in the sorter once `updatedAt` is guaranteed (if desired, simplify comparator to rely solely on `updatedAt`).
3. **Test**
   - Re-run targeted suites (`npm test -- useTodosState`, `npm test -- storage`, `npm test -- listManagementHooks`) to verify enforcement.
   - Execute any database migration/unit tests validating legacy rows receive `updated_at`.
4. **Review**

### Cycle 4 – E2E validation, docs, and quality gates

1. **Write test**
   - Extend `src/renderer/__tests__/e2e/list-management.test.tsx` (and related suites such as `src/renderer/__tests__/e2e/drag-drop-behavior.test.tsx`) to assert:
     - Newly created/duplicated lists appear first in the sidebar.
     - Renaming or editing todos bumps the list to the top after persistence.
2. **Code**
   - Apply any minor code/test tweaks surfaced by the e2e failures (e.g., ensuring `sortListsByRecency` runs in the relevant handler).
3. **Test**
   - Run the e2e suite (`npm test -- list-management`) followed by the repo-wide gates:  
     `npm run lint`, `npm run typecheck`, `npm test`.
4. **Docs & Comms**
   - Update `CHANGELOG.md` (Unreleased) and `docs/TODOLO.md` to document “sidebar lists sort by most recent update.”
   - For every modified file (`src/main/db.ts`, `src/renderer/features/todos/api/storage.ts`, store/hooks/tests, new helper), run `codacy_cli_analyze --rootPath=/Users/claudiacarvalho/Documents/GitHub/todolo --file=<path>`.
5. **Review**

## Acceptance Criteria

- `loadListsIndex` returns lists sorted by `COALESCE(updated_at, created_at)` descending; regression tests cover both empty and multi-row DB states.
- `useListsIndex` and all store actions rely on `sortListsByRecency`, guaranteeing the renderer sidebar shows the newest list first immediately after any mutation.
- Unit, integration, and e2e tests explicitly assert the new ordering, including edge cases with missing `updatedAt`.
- Logs clearly identify when recency sorting occurs and surface malformed timestamps.
- Documentation communicates the “most recently updated first” expectation.

## Checklist

- [ ] Strengthen database + renderer tests for recency ordering.
- [ ] Swap SQL in `src/main/db.ts` to the new recency-order query and mirror in seed path.
- [ ] Add `src/renderer/features/todos/utils/listOrdering.ts` and wire it through hooks and store actions.
- [ ] Verify all list mutations emit fresh `updatedAt` values (patch gaps if found).
- [ ] Update docs/CHANGELOG to describe the feature.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`.
- [ ] Execute `codacy_cli_analyze` for every edited file before commit.
