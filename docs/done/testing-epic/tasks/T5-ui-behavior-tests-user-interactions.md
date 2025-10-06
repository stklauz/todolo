Title: T5 – UI Behavior Tests with User Interactions (Happy Path)
Priority: P0
Depends On: T1, T4

Summary
Add user-centric tests for a single core happy path using `@testing-library/user-event`, and control debounced persistence with fake timers for deterministic saves.

Motivation
Current tests mostly assert API calls. We need to validate what users see and do: creating lists, adding todos, completing, indenting, and filtering.

Acceptance Criteria
- Use `user-event` for typing and keyboard interactions; replace most `fireEvent` usages where appropriate.
- Cover one end-to-end happy path guided by `docs/interaction.md`: initial app shows a selected list and input → create/select list → type a non-empty todo → press Enter to add next line → verify todo appears and is saved (debounced).
- Debounced save is asserted using fake timers, verifying a single save after the debounce window.
- Assertions are focused on visible UI state (DOM presence, aria roles, labels) rather than implementation details.
- Advanced flows (indent/outdent, filters) are explicitly out of scope for this task.

Notes
- Avoid features likely to churn (indent/outdent, filters) until the UI stabilizes; add later as separate tasks.
- Optional (P1): Add small renderer logic unit tests (reducers/selectors) if they exist, to validate state updates without rendering.
 - Reference `docs/interaction.md` for keyboard semantics (Enter only adds when non-empty; last empty todo cannot be deleted; checkbox disabled for empty todos) when choosing assertions for the happy path.

Deliverables
- Updates to `src/__tests__/e2e-basic.test.tsx` or new files under `src/__tests__/` to cover the above flows.
