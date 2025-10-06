Title: T7 – Migration/Corruption Robustness Tests (Targeted)
Priority: P2
Depends On: T4

Summary
Expand tests for migration scenarios and corrupted data inputs across list index and todo documents to ensure predictable, safe fallbacks.

Motivation
Only `null` and basic cases are covered. Real-world inputs include wrong versions and malformed shapes that must be handled gracefully.

Acceptance Criteria
- Cover two targeted cases for each doc type: wrong `version` and malformed shape (e.g., non-array `lists` or invalid `todos`).
- For each case, storage functions return safe defaults as documented in the code and do not throw.
- Debug logs include error/warn entries for corrupted inputs.

Deliverables
- Add cases to `src/renderer/features/todos/api/__tests__/storage.test.ts` (from T4) or a sibling file to cover these scenarios.
