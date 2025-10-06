# Phase 3 — Observability, Performance, Docs

Scope
- Add structured logs to DB and IPC
- Note DB tuning: enable foreign keys; consider index on todos(list_id, order_index)
- Update documentation and test guidance

Acceptance Criteria
- Logs include sourceListId, newListId, todoCount, durationMs on DB success
- IPC logs errors with a concise message and stack where available
- Docs (this folder) remain authoritative and up-to-date; testids documented

DB Notes
- Enable referential integrity when opening the DB:
  - PRAGMA foreign_keys = ON
- Consider adding index for read/copy performance:
  - CREATE INDEX IF NOT EXISTS idx_todos_list_order ON todos(list_id, order_index)

Observability
- DB: log start/end around duplicateList with timestamps to compute duration
- IPC: log only on error paths to avoid noise

Performance
- Soft expectation: ~1k todos duplicated in <200ms on typical machines
- If exceeded, instrument and revisit UI spinner/progress affordances

Docs & Testing
- Ensure ErrorCode table is stable and referenced in tests
- Keep UI test selectors (data-testid) stable: menu-duplicate-list, menu-delete-list

