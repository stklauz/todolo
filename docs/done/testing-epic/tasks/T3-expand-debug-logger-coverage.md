Title: T3 – Expand Debug Logger Coverage
Priority: P3 (Deferred for solo)
Depends On: T2

Summary
Add comprehensive tests for the debug logger to cover `measureSync`, decorators, log buffer caps, `getLogsByOperation`, and correctness of performance summaries.

Motivation
Current coverage focuses on basic enable/disable and simple timing. Deeper behaviors are untested and may hide defects.

Acceptance Criteria
- Tests cover `measureSync` path with deterministic timing.
- Decorators `measurePerformance` and `measureAsyncPerformance` are validated on example class methods (sync and async).
- Log buffer cap behavior is verified: pushing beyond the limit retains only the last `maxLogs` entries.
- `getLogsByOperation` returns expected entries (substring match behavior is documented and tested).
- `getPerformanceSummary` computes `count`, `totalTime`, and `avgTime` correctly for multiple operations; assertions verify numeric correctness.

Deliverables
- New file (suggested): `src/renderer/utils/__tests__/debug-advanced.test.ts` with the above coverage.

Solo Scope Note
- This task is intentionally deferred to keep immediate focus on core flows.
