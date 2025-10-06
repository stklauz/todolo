Title: T6 – Negative-Path UX Assertions (Minimal)
Priority: P1
Depends On: T5

Summary
When storage operations fail, the UI should communicate issues clearly. Extend tests to assert user-facing cues on errors and degraded states.

Motivation
Current tests only assert that the app doesn’t crash on failures. Users need feedback and guidance for recovery.

Acceptance Criteria
- Save failure: assert either a visible error indicator (if implemented) or that an error is logged without crashing.
- Load failure: app renders core UI and logs the error.
- Limit scope to one failing save and one failing load scenario.
- Document expected UX behavior and mark UI signals as TODO if not yet implemented.
 - Anchor negative-path expectations to `docs/interaction.md` rules where applicable (e.g., Enter on empty does nothing; cannot delete the last empty todo; empty todo checkbox disabled).

Deliverables
- New or updated tests under `src/__tests__/` that assert negative-path UX behavior for both load and save failures.

Follow-ups from T4
- Consolidate overlap with existing `src/__tests__/storage.test.ts` once broader coverage stabilizes (reduce duplication/noise). Consider as part of T5/T6 maintenance.
- Broaden API coverage to `saveAppSettings` with IPC contract + failure/malformed cases (tie-in with T5/T6 negative-path UX assertions).
- Expand malformed payload shapes for `loadListsIndex` and `loadListTodos` (e.g., non-array `lists`, missing `version`, malformed `todos` items) to support T7 robustness.
- Add positive-path debug/perf logging assertions for storage operations when debug mode is enabled (complements T3 – Debug Logger coverage).

Notes
- Carry-over from T5 review to cover here:
  - Enter on empty todo does nothing (no insert, no save, focus unchanged).
  - Backspace constraints: deleting an empty todo outdents first; cannot delete the last remaining todo.
  - Must always have at least one todo per list (an empty one is allowed; its checkbox must be disabled).
