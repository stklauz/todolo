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

Deliverables
- New or updated tests under `src/__tests__/` that assert negative-path UX behavior for both load and save failures.
