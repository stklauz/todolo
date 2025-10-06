# Phase 3 — Observability, Performance, Docs

Status: ✅ COMPLETED

## Scope
- ✅ Add structured logs to DB and IPC
- ✅ Enable foreign keys in database initialization
- ✅ Update documentation and test guidance

## Acceptance Criteria
- ✅ Logs include sourceListId, newListId, todoCount, durationMs on DB success
- ✅ IPC logs errors with a concise message and stack where available
- ✅ Docs (this folder) remain authoritative and up-to-date; testids documented

## Implementation Details

### DB Changes
- ✅ Enabled referential integrity when opening the DB:
  - `PRAGMA foreign_keys = ON` added to `openDatabase()` function
- ✅ Existing index for read/copy performance already in place:
  - `CREATE INDEX IF NOT EXISTS todos_list_order_idx ON todos(list_id, order_index)`

### Observability
- ✅ DB: Added structured logging around duplicateList with timestamps and metrics:
  - Start log with sourceListId
  - Success log with sourceListId, newListId, todoCount, durationMs
  - Error log with duration and stack trace
- ✅ IPC: Enhanced error logging with concise messages and stack traces

### Performance
- ✅ Soft expectation: ~1k todos duplicated in <200ms on typical machines
- ✅ Performance monitoring added via structured logging
- ✅ If exceeded, instrumentation is in place to revisit UI spinner/progress affordances

### Docs & Testing
- ✅ ErrorCode table is stable and referenced in tests
- ✅ UI test selectors (data-testid) remain stable: menu-duplicate-list, menu-delete-list
- ✅ All existing tests continue to pass with enhanced logging

## Logging Format

### DB Success Log
```
[DB] duplicateList completed: sourceListId=<id>, newListId=<id>, todoCount=<count>, durationMs=<ms>
```

### DB Error Log
```
[DB] duplicateList failed after <ms>ms: <error details>
```

### IPC Error Log
```
[IPC] duplicate-list failed after <ms>ms: <error message> <stack trace>
```

