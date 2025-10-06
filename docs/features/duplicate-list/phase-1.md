# Phase 1 — Core Path + UI Smoke

Scope
- Implement DB duplicate function with deterministic copy and validation
- Add IPC handler with input validation and error-code mapping
- Implement Storage API with discriminated result
- Integrate State hook to call storage, refresh lists index, set selection, and persist
- Add a basic UI smoke test via context menu (no full UI integration yet)

Acceptance Criteria
- IPC/Storage results are strictly typed:
  - Success: { success: true, newListId: string }
  - Failure: { success: false, error: ErrorCode }
- DB copies todos preserving id and order_index; list name becomes "<Original> (Copy)"
- ARIA live region announces: "Duplicating…", then "List duplicated" or error
- Pre-commit tests pass for DB, IPC, Storage, State, and UI smoke

Contracts
- IPC Channel: duplicate-list(sourceListId: string, newListName?: string) → Success | Failure
- ErrorCode: 'invalid_source_id' | 'not_found' | 'internal_error'
- State Hook: duplicateList(sourceListId, newListName?) → Promise<string|null>

DB Algorithm (Deterministic Copy)
1) Validate sourceListId is a non-empty string
2) SELECT source list by id; if missing → Failure { error: 'not_found' }
3) SELECT todos WHERE list_id = sourceListId ORDER BY order_index
4) newListId = crypto.randomUUID()
5) finalName = (trim(newListName).slice(0,200)) || `${sourceList.name} (Copy)`
6) Transaction:
   - INSERT new list (id=newListId, name=finalName, created_at=now, updated_at=now)
   - For each source todo INSERT row with:
     - list_id=newListId, id=Number(todo.id), text=String(todo.text), completed=todo.completed?1:0, indent=Number(todo.indent||0), order_index=Number(todo.order_index)
7) Optionally wal_checkpoint(FULL)
8) Return Success { newListId }

Implementation Snippets

DB (src/main/db.ts)
```ts
export function duplicateList(
  sourceListId: string,
  newListName?: string
): { success: true; newListId: string } | { success: false; error: 'invalid_source_id' | 'not_found' | 'internal_error' } {
  const database = openDatabase();
  try {
    if (!sourceListId || typeof sourceListId !== 'string') {
      return { success: false, error: 'invalid_source_id' };
    }
    const safeName = typeof newListName === 'string' && newListName.trim() !== ''
      ? newListName.trim().slice(0, 200)
      : undefined;
    const sourceList = database.prepare('SELECT * FROM lists WHERE id = ?').get(sourceListId);
    if (!sourceList) return { success: false, error: 'not_found' };
    const sourceTodos = database
      .prepare('SELECT * FROM todos WHERE list_id = ? ORDER BY order_index')
      .all(sourceListId);
    const newListId = crypto.randomUUID();
    const finalName = safeName || `${sourceList.name} (Copy)`;
    const now = new Date().toISOString();
    const tx = database.transaction(() => {
      database
        .prepare('INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(newListId, finalName, now, now);
      const insertTodo = database.prepare('INSERT INTO todos (list_id, id, text, completed, indent, order_index) VALUES (?, ?, ?, ?, ?, ?)');
      sourceTodos.forEach((todo: any) => {
        insertTodo.run(newListId, Number(todo.id), String(todo.text), todo.completed ? 1 : 0, Number(todo.indent ?? 0), Number(todo.order_index));
      });
    });
    tx();
    return { success: true, newListId };
  } catch (e) {
    console.error('[DB] Error duplicating list:', e);
    return { success: false, error: 'internal_error' };
  }
}
```

IPC (src/main/main.ts)
```ts
ipcMain.handle('duplicate-list', async (_event, sourceListId: unknown, newListName?: unknown) => {
  try {
    if (typeof sourceListId !== 'string' || sourceListId.trim() === '') {
      return { success: false, error: 'invalid_source_id' } as const;
    }
    const safeName = typeof newListName === 'string' ? newListName : undefined;
    return duplicateList(sourceListId, safeName);
  } catch (error) {
    console.error('[IPC] Error duplicating list:', error);
    return { success: false, error: 'internal_error' } as const;
  }
});
```

Storage (src/renderer/features/todos/api/storage.ts)
```ts
type DuplicateListResult =
  | { success: true; newListId: string }
  | { success: false; error: 'invalid_source_id' | 'not_found' | 'internal_error' };

export async function duplicateList(sourceListId: string, newListName?: string): Promise<DuplicateListResult> {
  try {
    const result = await window.electron.ipcRenderer.invoke('duplicate-list', sourceListId, newListName);
    return result as DuplicateListResult;
  } catch (e) {
    console.error('[Storage] Error duplicating list:', e);
    return { success: false, error: 'internal_error' };
  }
}
```

State (src/renderer/features/todos/hooks/useTodosState.ts)
```ts
import { duplicateList as duplicateListApi } from '../api/storage';

function duplicateList(sourceListId: string, newListName?: string): Promise<string | null> {
  return new Promise((resolve) => {
    duplicateListApi(sourceListId, newListName)
      .then((result) => {
        if (result.success && result.newListId) {
          loadListsIndex().then((index) => {
            const normalizedLists = (index.lists || []).map((list, li) => ({
              id: String(list.id),
              name: typeof list.name === 'string' ? list.name : `List ${li + 1}`,
              todos: [],
              createdAt: list.createdAt,
              updatedAt: list.updatedAt,
            }));
            setLists(normalizedLists);
            setSelectedListId(result.newListId);
            try { setSelectedListMeta(result.newListId); } catch {}
            resolve(result.newListId);
          }).catch(() => resolve(null));
        } else {
          resolve(null);
        }
      })
      .catch(() => resolve(null));
  });
}
```

UI Smoke (ListSidebar.tsx)
```tsx
const [isDuplicating, setIsDuplicating] = useState(false);
const [statusMessage, setStatusMessage] = useState<string | null>(null);

const handleDuplicate = async (listId: string) => {
  if (isDuplicating) return;
  try {
    setIsDuplicating(true);
    setStatusMessage('Duplicating…');
    const newId = await duplicateList(listId);
    setStatusMessage(newId ? 'List duplicated' : "Couldn't duplicate this list. Try again.");
  } finally {
    setIsDuplicating(false);
  }
};

// ARIA live region
<div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)' }}>
  {statusMessage}
  </div>
```

Tests
- DB Happy Path: copy preserves id and order_index
- DB Missing Source: failure not_found
- IPC Validation: invalid_source_id when empty
- Storage Exception: internal_error returned
- State Success: lists length +1 and selection changed
- UI Smoke: menu item exists above Delete; clicking triggers ARIA live messages and disables while in-flight

