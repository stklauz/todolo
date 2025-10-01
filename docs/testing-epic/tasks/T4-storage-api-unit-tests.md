Title: T4 – Storage API Unit Tests (Minimal + IPC Contracts)
Priority: P0
Depends On: T1

Summary
Create unit tests for storage API functions to cover happy paths, IPC failures, and malformed payloads, ensuring safe defaults and proper logging.

Motivation
Storage is only indirectly exercised through component tests with mocks. Direct unit tests will validate fallback logic and data validation.

Acceptance Criteria
- Unit tests exist for: `loadListsIndex`, `saveListTodos`, and `loadAppSettings` (minimal critical surface). Others optional for now.
- Happy path assertions: valid payloads return expected data and success flags.
- Two failure shapes per function: one IPC rejection/exception; one malformed payload (e.g., wrong version, non-array lists).
- Functions return safe defaults and log errors via debug logger.
- `window.electron.ipcRenderer.invoke` is mocked per test; no cross-test leakage.

- IPC contract checks: for each tested function, assert the correct channel and argument shape are passed to `invoke`:
  - `loadListsIndex` → `load-lists` (no args)
  - `saveListTodos` → `save-list-todos` (listId, doc)
  - `loadAppSettings` → `load-app-settings` (no args)

Deliverables
- New file (suggested): `src/renderer/features/todos/api/__tests__/storage.test.ts` with the above coverage.
- Optional helper (P1 addendum): `src/__tests__/factories/storage.ts` with tiny builders for `ListsIndexV2` and `ListTodosV2` to keep tests readable.
