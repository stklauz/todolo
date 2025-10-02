## Storage layout and migration plan

### Current
- Legacy single file at `userData/todos.json` containing either:
  - legacy: an array of todos, or
  - v1: `{ version: 1, lists: TodoList[], selectedListId?: string }`
- Transitional per-list JSON under `userData/data/` may exist from v2 JSON layout.

### Target (SQLite, main-process)
- Database file: `userData/todolo.db`
- Tables:
  - `lists(id TEXT PRIMARY KEY, name TEXT, created_at TEXT, updated_at TEXT)`
  - `todos(list_id TEXT, id INTEGER, text TEXT, completed INTEGER, indent INTEGER, order_index INTEGER, PRIMARY KEY(list_id, id))`
  - `meta(key TEXT PRIMARY KEY, value TEXT)`
- Access pattern follows ERB best practices:
  - DB lives in main process; renderer accesses via IPC only.
  - Queries are synchronous via better-sqlite3; operations are wrapped in small transactions.

### IPC API (unchanged from renderer’s perspective)
- `load-lists` -> returns `{ version: 2, lists, selectedListId }` from SQLite
- `save-lists` (index) -> upserts lists and selection in SQLite
- `load-list-todos` (id) -> returns `{ version: 2, todos }` ordered by `order_index`
- `save-list-todos` (id, todos)` -> transactionally replaces a list’s todos preserving order

### Migration Strategy
- On first DB open (no rows in `lists`):
  1) If per-list JSON index `userData/data/lists.json` exists, import lists and each `list-<id>.json` todos.
  2) Else if legacy `userData/todos.json` exists:
     - If array: create single list and import todos.
     - If v1 app object: import lists and nested list todos.
  3) Store `selectedListId` in `meta` if present.
- JSON files are left in place as a safety net; DB becomes the source of truth.

### Renderer expectations
- No changes required. The same IPC channels are used; the main process now serves from SQLite.

### Versioning
- IPC object shapes continue using `version: 2` for compatibility.

### Renderer Validation
- The renderer validates incoming payloads defensively:
  - Lists index must have `version: 2` and `lists` as an array.
  - Each list item must include `id`, `name`, and `createdAt` as strings; invalid items are filtered out with a warn log.
  - `selectedListId` is only preserved if it refers to a remaining valid list; otherwise it is cleared.
  - List todos must have `version: 2` and `todos` as an array; malformed payloads fall back to `{ version: 2, todos: [] }` with a warn log.
  - Any IPC error returns safe defaults without throwing.
