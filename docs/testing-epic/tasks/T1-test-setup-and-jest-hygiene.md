Title: T1 – Test Setup & Jest Hygiene
Priority: P0
Depends On: —

Summary
Clean up the global test setup and improve Jest configuration to prevent cross-test leakage, remove anti-patterns, and standardize behavior for deterministic runs.

Motivation
The current setup file includes a dummy test and lacks automatic mock reset/restore. Console output from debug logging can spam runs. Establishing clean test boundaries reduces flakiness and makes results easier to interpret.

Acceptance Criteria
- Remove any tests from `src/__tests__/setup.ts`; the file only prepares environment and mocks.
- Global console noise is suppressed during tests (spy/mute `console.log`, `console.warn`, `console.error`) and restored after each test.
- Add to Jest config (`package.json` under `jest`): `clearMocks: true`, `resetMocks: true`, and `restoreMocks: true`.
- All existing tests pass locally with clean output (no unexpected console spam), and no new globals leak between tests.
- Document short instructions for adding new tests with these conventions.

Notes
- Keep T1 focused on hygiene; introduce test data factories only when needed (see T4 optional helper) to avoid premature abstractions.

Deliverables
- Updated `src/__tests__/setup.ts` with console spies and without tests.
- Updated `package.json` Jest config.
