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

Implementation (in-repo changes)
- Moved Jest setup to `src/test/setup.ts` and updated `package.json:jest.setupFilesAfterEnv` accordingly; removed specific ignore from `testPathIgnorePatterns`.
- Added `test:ci` script to run Jest in verbose, serial mode for CI determinism.

Recommended CI notes (actionable when CI is available)
- Pin Node.js (e.g., `node 20.x`) using the CI runner image or an `.nvmrc` at repo root.
- Use `npm run test:ci` to run tests:
  - Suggested flags: `--runInBand --verbose --ci`.
  - Optionally add reporters (e.g., JUnit) when CI supports artifact uploads.
- Consider a flake-check job that repeats timing‑sensitive suites N times weekly.

Local guidance
- Developers can run `npm run test:ci` to mirror CI behavior when debugging timing or order‑dependent issues.


Deliverables
- CI-oriented notes in this task doc and, if applicable, updates to CI configuration files (out of scope for code here, but criteria should be actionable).
