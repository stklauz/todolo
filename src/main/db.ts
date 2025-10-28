/* eslint-disable no-console */
import path from 'path';
import { app } from 'electron';
import crypto from 'crypto';

// We use better-sqlite3 for fast, local, embedded storage in the main process
// Following ERB patterns: keep all storage in main and expose via IPC
// Note: better-sqlite3 is a native dependency and must be installed/built
// during packaging. See package.json changes for dependency.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');

// Type for better-sqlite3 database instance
type DatabaseInstance = {
  prepare: (sql: string) => any;
  exec: (sql: string) => void;
  pragma: (sql: string) => any;
  close: () => void;
  transaction: (fn: () => void) => any;
};

// Type for database rows
type DatabaseRow = {
  [key: string]: unknown;
};

export type EditorTodo = {
  id: number;
  text: string;
  completed: boolean;
  indent?: number;
};

export type ListsIndexV2 = {
  version: 2;
  lists: Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  selectedListId?: string;
};

export type AppSettings = {
  hideCompletedItems: boolean;
};

type DB = DatabaseInstance;
let db: DB | null = null;

const getUserDataDir = () => app.getPath('userData');

function safeJoinUserData(filename: string): string {
  if (filename !== 'todolo.db') {
    throw new Error('Invalid filename for database');
  }
  const base = path.resolve(getUserDataDir());
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
  const full = path.resolve(base, filename);
  // Security check: ensure the resolved path is within the userData directory
  // This prevents path traversal attacks (e.g., "../../../etc/passwd")
  if (!full.startsWith(base + path.sep)) {
    throw new Error('Unsafe database path');
  }
  return full;
}

function getDbPath() {
  const dbPath = safeJoinUserData('todolo.db');
  return dbPath;
}

export function openDatabase(): DB {
  if (db) {
    // reuse existing db connection
    return db;
  }
  const dbPath = getDbPath();
  // open database
  db = new Database(dbPath);
  // At this point db is guaranteed to be non-null since we just assigned it
  db!.pragma('journal_mode = WAL');
  db!.pragma('wal_autocheckpoint=1000');
  db!.pragma('synchronous = NORMAL');
  db!.pragma('temp_store = MEMORY');
  db!.pragma('foreign_keys = ON');

  applyMigrations(db!);
  return db!;
}

export function closeDatabase(): void {
  if (db) {
    try {
      // checkpoint WAL and close
      // Force WAL checkpoint to ensure all data is written to main database
      const result = db.pragma('wal_checkpoint(FULL)');
      void result;
      // Ensure all pending transactions are committed
      db.pragma('synchronous = FULL');
      db.close();
    } catch (error) {
      console.error('[DB] Error closing database:', error);
    } finally {
      db = null;
    }
  }
}

function applyMigrations(database: DB) {
  const createMeta = `
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );`;
  const createLists = `
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );`;
  const createTodos = `
    CREATE TABLE IF NOT EXISTS todos (
      list_id TEXT NOT NULL,
      id INTEGER NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      indent INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL,
      PRIMARY KEY (list_id, id),
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
    );`;
  const createAppSettings = `
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`;
  // Support fast ordered reads of todos by (list_id, order_index)
  const createTodosListOrderIdx = `
    CREATE INDEX IF NOT EXISTS todos_list_order_idx
    ON todos(list_id, order_index);
  `;

  database.exec(
    `${createMeta}${createLists}${createTodos}${createTodosListOrderIdx}${createAppSettings}`,
  );
}

export function loadListsIndex(): ListsIndexV2 {
  const database = openDatabase();
  const lists = database
    .prepare(
      'SELECT id, name, created_at as createdAt, updated_at as updatedAt FROM lists ORDER BY created_at ASC',
    )
    .all();
  let selectedRow = database
    .prepare('SELECT value FROM meta WHERE key = ?')
    .get('selectedListId');

  // Seed a default list if DB is completely empty to avoid UI arriving with nothing
  if (!lists || lists.length === 0) {
    const id = (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : String(Date.now());
    const now = new Date().toISOString();
    const upsertList = database.prepare(
      'INSERT OR REPLACE INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    );
    const setMeta = database.prepare(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    );
    const tx = database.transaction(() => {
      upsertList.run(id, 'My Todos', now, now);
      setMeta.run('selectedListId', id);
    });
    tx();
    // no per-save checkpoint
    // default list seeded for empty DB
    const seeded = database
      .prepare(
        'SELECT id, name, created_at as createdAt, updated_at as updatedAt FROM lists ORDER BY created_at ASC',
      )
      .all();
    selectedRow = { value: id };
    // seeded list loaded
    return { version: 2, lists: seeded, selectedListId: id };
  }

  return {
    version: 2,
    lists,
    selectedListId:
      selectedRow && selectedRow.value ? String(selectedRow.value) : undefined,
  };
}

export function saveListsIndex(index: ListsIndexV2): {
  success: boolean;
  error?: string;
} {
  const database = openDatabase();
  try {
    // Observability: summarize incoming index save
    try {
      const incomingIds = index.lists.map((l) => l.id);
      console.log(
        `[DB] saveListsIndex called with ${incomingIds.length} lists; selected=${index.selectedListId ?? 'none'}`,
      );
    } catch {}

    const existing = new Set<string>(
      database
        .prepare('SELECT id FROM lists')
        .all()
        .map((r: any) => r.id),
    );
    // Compute which existing lists are NOT present in the incoming index document
    // We intentionally do not delete these here to avoid accidental data loss.
    const requested = new Set(index.lists.map((l) => l.id));
    const missing = Array.from(existing).filter((id) => !requested.has(id));
    if (missing.length > 0) {
      console.warn(
        '[DB] saveListsIndex: deletions are disabled here; missing ids will NOT be deleted:',
        missing,
      );
    }
    // Do NOT delete missing lists on index save to avoid
    // accidental data loss during startup/HMR when partial
    // state may be sent from the renderer.
    const upsertList = database.prepare(
      'INSERT INTO lists (id, name, created_at, updated_at) VALUES (@id, @name, @created_at, @updated_at) \
       ON CONFLICT(id) DO UPDATE SET \
         name=excluded.name, \
         created_at=excluded.created_at, \
         updated_at=excluded.updated_at',
    );
    // const delTodos = database.prepare('DELETE FROM todos WHERE list_id = ?');
    // const delList = database.prepare('DELETE FROM lists WHERE id = ?');
    const setMeta = database.prepare(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    );
    const tx = database.transaction(() => {
      // Deletions intentionally disabled here; handle explicit deletions elsewhere.
      for (const l of index.lists) {
        upsertList.run({
          id: l.id,
          name: l.name,
          created_at: l.createdAt,
          updated_at: l.updatedAt ?? null,
        });
      }
      // Only update selectedListId if provided to avoid clobbering
      // a previously saved selection with an empty string during
      // early, debounced saves on startup.
      if (index.selectedListId != null && index.selectedListId !== '') {
        setMeta.run('selectedListId', index.selectedListId);
        // update selected list id
      } else {
        // skip updating selected list id when empty
      }
    });
    tx();

    // no per-save checkpoint
    try {
      console.log(
        `[DB] saveListsIndex succeeded; upserted=${index.lists.length}; selected=${index.selectedListId ?? 'none'}`,
      );
    } catch {}
    return { success: true };
  } catch (e: any) {
    console.error('[DB] saveListsIndex error:', e);
    return { success: false, error: e?.message || String(e) };
  }
}

export function loadListTodos(listId: string): {
  version: 2;
  todos: EditorTodo[];
} {
  const database = openDatabase();
  const rows = database
    .prepare(
      'SELECT id, text, completed, indent FROM todos WHERE list_id = ? ORDER BY order_index ASC',
    )
    .all(listId);
  // rows loaded from todos
  const todos: EditorTodo[] = rows.map((r: DatabaseRow) => ({
    id: Number(r.id),
    text: String(r.text),
    completed: !!r.completed,
    indent: Number(r.indent ?? 0),
  }));
  return { version: 2, todos };
}

export function saveListTodos(
  listId: string,
  doc: { version: 2; todos: EditorTodo[] },
): { success: boolean; error?: string } {
  const database = openDatabase();
  try {
    // replace list todos atomically
    const del = database.prepare('DELETE FROM todos WHERE list_id = ?');
    const ins = database.prepare(
      'INSERT INTO todos (list_id, id, text, completed, indent, order_index) VALUES (@list_id, @id, @text, @completed, @indent, @order_index)',
    );
    const ensureList = database.prepare('SELECT id FROM lists WHERE id = ?');
    const createList = database.prepare(
      'INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    );
    const countExisting = database.prepare(
      'SELECT COUNT(*) as c FROM todos WHERE list_id = ?',
    );

    // If DB already has rows and incoming doc looks like a seed/placeholder (<=1 empty row), skip to avoid wiping data
    try {
      const row = countExisting.get(listId) as any;
      const existingCount = Number(row?.c ?? 0);
      const looksLikeSeed =
        Array.isArray(doc.todos) &&
        doc.todos.length <= 1 &&
        doc.todos.every(
          (t) => String(t.text ?? '').trim() === '' && !t.completed,
        );
      if (existingCount > 0 && looksLikeSeed) {
        // skip seed save when existing data present
        return { success: true };
      }
    } catch {}
    const tx = database.transaction(() => {
      // Ensure parent list exists to satisfy FK constraint.
      // If missing, create a placeholder row to avoid races with index saves.
      const found = ensureList.get(listId);
      if (!found) {
        const now = new Date().toISOString();
        // Use a placeholder name; it will be upserted later by saveListsIndex
        createList.run(listId, 'Untitled', now, now);
      }
      del.run(listId);
      let idx = 0;
      for (const t of doc.todos) {
        ins.run({
          list_id: listId,
          id: t.id,
          text: t.text,
          completed: t.completed ? 1 : 0,
          indent: Number(t.indent ?? 0),
          order_index: idx++,
        });
      }
    });
    tx();
    // no per-save checkpoint
    return { success: true };
  } catch (e: any) {
    console.error(`[DB] Error saving todos for list ${listId}:`, e);
    return { success: false, error: e?.message || String(e) };
  }
}

export function loadAppSettings(): AppSettings {
  const database = openDatabase();
  const hideCompletedRow = database
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get('hideCompletedItems');
  return {
    hideCompletedItems: hideCompletedRow
      ? hideCompletedRow.value === 'true'
      : true,
  };
}

export function saveAppSettings(settings: AppSettings): {
  success: boolean;
  error?: string;
} {
  const database = openDatabase();
  try {
    const upsert = database.prepare(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    );
    const tx = database.transaction(() => {
      upsert.run(
        'hideCompletedItems',
        settings.hideCompletedItems ? 'true' : 'false',
      );
    });
    tx();
    return { success: true };
  } catch (e: any) {
    console.error(`[DB] Error saving app settings:`, e);
    return { success: false, error: e?.message || String(e) };
  }
}

// Persist selected list id directly in meta table.
export function setSelectedListMeta(listId: string | null): void {
  const database = openDatabase();
  try {
    if (listId && listId !== '') {
      const setMeta = database.prepare(
        'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      );
      setMeta.run('selectedListId', listId);
      // no per-save checkpoint
    }
  } catch (e: any) {
    console.error('[DB] Error setting selectedListId in meta:', e);
  }
}

export function duplicateList(
  sourceListId: string,
  newListName?: string,
):
  | { success: true; newListId: string }
  | {
      success: false;
      error: 'invalid_source_id' | 'not_found' | 'internal_error';
    } {
  const startTime = performance.now();
  const database = openDatabase();

  try {
    console.log(`[DB] duplicateList started for sourceListId=${sourceListId}`);

    if (!sourceListId || typeof sourceListId !== 'string') {
      return { success: false, error: 'invalid_source_id' };
    }
    const safeName =
      typeof newListName === 'string' && newListName.trim() !== ''
        ? newListName.trim().slice(0, 200)
        : undefined;
    // Only select what we need for naming
    const sourceList = database
      .prepare('SELECT name FROM lists WHERE id = ?')
      .get(sourceListId);
    if (!sourceList) return { success: false, error: 'not_found' };
    const newListId = crypto.randomUUID();
    const finalName = safeName || `${sourceList.name} (Copy)`;
    const now = new Date().toISOString();

    const tx = database.transaction(() => {
      database
        .prepare(
          'INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        )
        .run(newListId, finalName, now, now);

      // Copy todos but assign NEW ids within the new list to ensure
      // global uniqueness across lists and avoid any coupling via ids.
      const selectTodos = database.prepare(
        `SELECT text, completed, indent, order_index
         FROM todos
         WHERE list_id = ?
         ORDER BY order_index`,
      );
      const insertTodo = database.prepare(
        'INSERT INTO todos (list_id, id, text, completed, indent, order_index) VALUES (?, ?, ?, ?, ?, ?)',
      );

      const rows = selectTodos.all(sourceListId) as Array<{
        text: string;
        completed: number;
        indent: number;
        order_index: number;
      }>;

      // Assign sequential ids in the duplicated list, preserving order.
      let nextId = 1;
      for (const r of rows) {
        insertTodo.run(
          newListId,
          nextId++,
          r.text,
          r.completed ? 1 : 0,
          Number(r.indent ?? 0),
          r.order_index,
        );
      }
    });
    tx();

    // Get todo count for logging
    const todoCount = database
      .prepare('SELECT COUNT(*) as count FROM todos WHERE list_id = ?')
      .get(newListId) as { count: number };

    const duration = performance.now() - startTime;
    const idRange = todoCount.count > 0 ? `1..${todoCount.count}` : 'empty';
    console.log(
      `[DB] duplicateList completed: sourceListId=${sourceListId}, newListId=${newListId}, todoCount=${todoCount.count}, durationMs=${duration.toFixed(2)} (ids remapped, newIdRange=${idRange})`,
    );

    return { success: true, newListId };
  } catch (e) {
    const duration = performance.now() - startTime;
    console.error(
      `[DB] duplicateList failed after ${duration.toFixed(2)}ms:`,
      e,
    );
    return { success: false, error: 'internal_error' };
  }
}

export function deleteList(listId: string): {
  success: boolean;
  error?: string;
} {
  const database = openDatabase();
  try {
    if (!listId || typeof listId !== 'string') {
      return { success: false, error: 'invalid_list_id' };
    }
    console.log('[DB] deleteList called', { listId });
    const delTodos = database.prepare('DELETE FROM todos WHERE list_id = ?');
    const delList = database.prepare('DELETE FROM lists WHERE id = ?');
    const getSelected = database
      .prepare('SELECT value FROM meta WHERE key = ?')
      .get('selectedListId');
    const clearMeta = database.prepare('DELETE FROM meta WHERE key = ?');
    const tx = database.transaction(() => {
      delTodos.run(listId);
      delList.run(listId);
      if (getSelected && String(getSelected.value) === listId) {
        clearMeta.run('selectedListId');
      }
    });
    tx();
    // no per-save checkpoint
    console.log('[DB] deleteList succeeded', { listId });
    return { success: true };
  } catch (e: any) {
    console.error('[DB] deleteList error:', e);
    return { success: false, error: e?.message || String(e) };
  }
}
