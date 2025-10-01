# Epic: Stabilize and Expand Test Suite Quality

Owner: Solo Dev (AI-assisted)
Status: Proposed (Solo Streamlined Plan)
Goal: Improve correctness, stability, and coverage of the Jest test suite for Todolo with a lean, high-ROI sequence suited for solo development.

Scope
- Renderer unit and integration tests (React + Testing Library)
- Debug logger tests
- Storage API tests
- Jest configuration and test setup

Out of Scope
- End-to-end tests with real Electron main process
- Visual regression testing

Priorities and Order (Solo-Optimized)
1) T1 – Test Setup & Jest Hygiene (P0)
2) T2 – Stabilize Timing in Debug Tests (P0)
3) T4 – Storage API Unit Tests (minimal) (P0)
4) T5 – UI Behavior Tests (single happy path) (P0)
5) T6 – Negative-Path UX Assertions (minimal) (P1)
6) T7 – Migration/Corruption Robustness (targeted) (P2)
7) T3 – Expand Debug Logger Coverage (deferred depth) (P3)
8) T8 – CI Stability & Reporting Enhancements (deferred) (P3)

Success Criteria
- Deterministic local runs with no timing-related flakes.
- Core happy path (create list, add todo, save) asserted via visible UI.
- Storage API happy path + key failure cases return safe defaults and are covered.
- Console noise minimized; debug timing covered without deep decorator/buffer-cap tests.

Notes for Solo Scope
- Defer deep debug-logger coverage (decorators, buffer cap stress, full summary math) to later.
- Keep negative-path UX assertions minimal until visible error UI exists.
- Target a couple realistic migration/corruption cases only.
- CI/reporting upgrades can wait until releases are automated.
 - Tech debt: when reorganizing tests (post T5), consider moving Jest setup out of `__tests__` and removing the ignore rule.

Tasks
- See individual task docs in `docs/testing-epic/tasks` with updated priorities and scope.

## Conventions for New Tests
- Tests run with `jsdom`; prefer Testing Library over shallow renders.
- Avoid console noise: any `console.log/warn/error` is muted globally; assert on logs via spies only when required.
- Rely on Jest hygiene: `clearMocks`, `resetMocks`, and `restoreMocks` are enabled; do not depend on mock state across tests.
- Keep `src/__tests__/setup.ts` test-free; use it only for environment prep and global mocks.
- Prefer explicit user-facing assertions (text/role) over implementation details.

### Asserting console output in a specific test
- Use a local spy in the test and capture calls:
  - `const spy = jest.spyOn(console, 'error').mockImplementation(() => {});`
  - Run the code, then `expect(spy).toHaveBeenCalledWith(expect.stringMatching(/message/));`
  - No manual restore needed thanks to `restoreMocks: true`.

### Overriding the global electron mock
- The global `window.electron` mock is `configurable`, so tests can replace it when needed:
  - `Object.defineProperty(window, 'electron', { configurable: true, value: { ipcRenderer: { invoke: jest.fn() } } });`
