Title: T2 – Stabilize Timing in Debug Tests
Priority: P0
Depends On: T1

Summary
Eliminate flakiness in `debugLogger` timing tests by replacing busy-wait loops and real time assertions with deterministic time control using fake timers and/or a mocked `performance.now()`.

Motivation
Tests asserting durations like "< 10ms" are environment-sensitive and flaky. Deterministic time control ensures consistent outcomes across machines and CI.

Acceptance Criteria
- No tests use busy-wait loops or rely on wall-clock timing.
- Timing assertions in `src/renderer/__tests__/debug.test.ts` are driven by fake timers and/or mocked `performance.now()`.
- Durations are asserted deterministically (e.g., exactly 5ms), not with broad thresholds.
- The test suite passes on repeated runs without intermittent failures.
 - Keep scope focused on existing tests; defer decorator coverage to T3.

Deliverables
- Refactored `src/renderer/__tests__/debug.test.ts` using `jest.useFakeTimers()` and/or `jest.spyOn(performance, 'now')` with controlled return values.
