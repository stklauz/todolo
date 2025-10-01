Title: T8 – CI Stability & Reporting Enhancements (Deferred)
Priority: P3
Depends On: T1, T2

Summary
Harden CI test runs with consistent environment, better output, and basic flake detection to increase trust in the pipeline.

Motivation
Even with deterministic tests, CI differences can introduce noise. Standardizing runtime and improving reporting helps triage failures quickly.

Acceptance Criteria
- Document recommended Node version and set it in CI (nvm or CI config).
- Enable Jest verbose mode in CI or per-run flags for clearer failure context.
- Optional: run a repeated subset (e.g., `--runInBand` for timing-sensitive suites) to confirm no flakes.
- Collect and publish Jest JUnit or JSON reports (if CI supports it) for historical tracking.
 - Note: This task is deferred until release automation; keep local runs deterministic meanwhile.
 - Housekeeping: relocate Jest setup from `src/__tests__/setup.ts` to `src/test/setup.ts` (or `jest.setup.ts`) and remove its ignore from `testPathIgnorePatterns` as part of a broader test layout cleanup.

Deliverables
- CI-oriented notes in this task doc and, if applicable, updates to CI configuration files (out of scope for code here, but criteria should be actionable).
