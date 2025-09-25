## Storage layout and migration plan

### Current
- Single file at `userData/todos.json` containing either:
  - legacy: an array of todos, or
  - v1: `{ version: 1, lists: TodoList[], selectedListId?: string }`

### Target (per-list files)
- Directory: `userData/data/`
- Index file: `userData/data/©`
  - Shape: `{ version: 2, lists: Array<{ id: string; name: string; createdAt: string; updatedAt?: string }>, selectedListId?: string }`
- Per-list todos file: `userData/data/list-<id>.json`
  - Shape: `{ version: 2, todos: EditorTodo[] }`

Notes:
- All writes are atomic: write to `<file>.tmp` then `rename` to `<file>`.
- Keep a single `.bak` backup of the previous successful write if needed (future enhancement).

### IPC API (main process)
- `load-lists` -> returns index data
- `save-lists` (index) -> writes lists.json
- `load-list-todos` (id) -> returns todos for a list
- `save-list-todos` (id, todos) -> writes `list-<id>.json`

Legacy compatibility:
- Existing handlers `load-todos`/`save-todos` are kept.
- On first `load-lists` call, if `lists.json` doesn’t exist but `todos.json` does, migrate:
  1) If legacy array: create one list with generated id and use array as its todos.
  2) If v1 object: copy `lists` metadata into `lists.json`, and write each list's todos to `list-<id>.json`.

### Renderer expectations
- Lists are loaded first from `load-lists`. Todos are lazy-loaded via `load-list-todos` when a list becomes active.
- Saving lists (rename, add/remove, selection change) uses `save-lists`.
- Saving todos for current list uses `save-list-todos` with debounce.

### Versioning
- Index and per-list files use `version: 2`.
- Migration from v1 happens once, idempotent: creation of `lists.json` and `list-<id>.json` files indicates migration done.


