import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import crypto from 'crypto';

// We use better-sqlite3 for fast, local, embedded storage in the main process
// Following ERB patterns: keep all storage in main and expose via IPC
// Note: better-sqlite3 is a native dependency and must be installed/built
// during packaging. See package.json changes for dependency.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');

export type EditorTodo = {
  id: number;
  text: string;
  completed: boolean;
  indent?: number;
};

export type ListsIndexV2 = {
  version: 2;
  lists: Array<{ id: string; name: string; createdAt: string; updatedAt?: string }>;
  selectedListId?: string;
};

export type AppSettings = {
  hideCompletedItems: boolean;
};

type DB = any;
let db: DB | null = null;

const getUserDataDir = () => app.getPath('userData');

function getDbPath() {
  // Always use the Electron userData directory; no env overrides in any mode.
  const dir = getUserDataDir();
  const dbPath = path.join(dir, 'todolo.db');
  // Use Electron userData directory for storage

  // Ensure the target directory exists
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      // created userData directory
    }
  } catch (error) {
    console.error(`[DB] Failed to create directory ${dir}:`, error);
    throw new Error(`Cannot create database directory: ${dir}`);
  }

  // database path resolved
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
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  applyMigrations(db);
  return db;
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
  database.exec(`${createMeta}${createLists}${createTodos}${createAppSettings}`);
}

export function loadListsIndex(): ListsIndexV2 {
  const database = openDatabase();
  const lists = database
    .prepare('SELECT id, name, created_at as createdAt, updated_at as updatedAt FROM lists ORDER BY created_at ASC')
    .all();
  let selectedRow = database.prepare('SELECT value FROM meta WHERE key = ?').get('selectedListId');

  // Seed a default list if DB is completely empty to avoid UI arriving with nothing
  if (!lists || lists.length === 0) {
    const id = (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now());
    const now = new Date().toISOString();
    const upsertList = database.prepare(
      'INSERT OR REPLACE INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    );
    const setMeta = database.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
    const tx = database.transaction(() => {
      upsertList.run(id, 'My Todos', now, now);
      setMeta.run('selectedListId', id);
    });
    tx();
    database.pragma('wal_checkpoint(FULL)');
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
    selectedListId: selectedRow && selectedRow.value ? String(selectedRow.value) : undefined,
  };
}

export function saveListsIndex(index: ListsIndexV2): { success: boolean; error?: string } {
  const database = openDatabase();
  try {
    const existing = new Set<string>(
      database
        .prepare('SELECT id FROM lists')
        .all()
        .map((r: any) => r.id),
    );
    // Do NOT delete missing lists on index save to avoid
    // accidental data loss during startup/HMR when partial
    // state may be sent from the renderer.
    const upsertList = database.prepare(
      'INSERT INTO lists (id, name, created_at, updated_at) VALUES (@id, @name, @created_at, @updated_at) \
       ON CONFLICT(id) DO UPDATE SET \
         name=excluded.name, \
         created_at=excluded.created_at, \
         updated_at=excluded.updated_at'
    );
    // const delTodos = database.prepare('DELETE FROM todos WHERE list_id = ?');
    // const delList = database.prepare('DELETE FROM lists WHERE id = ?');
    const setMeta = database.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
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
    
    // Force WAL checkpoint after each save to ensure data persistence
    database.pragma('wal_checkpoint(FULL)');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

export function loadListTodos(listId: string): { version: 2; todos: EditorTodo[] } {
  const database = openDatabase();
  const rows = database
    .prepare(
      'SELECT id, text, completed, indent FROM todos WHERE list_id = ? ORDER BY order_index ASC',
    )
    .all(listId);
  // rows loaded from todos
  const todos: EditorTodo[] = rows.map((r: any) => ({
    id: Number(r.id),
    text: String(r.text),
    completed: !!r.completed,
    indent: Number(r.indent ?? 0),
  }));
  return { version: 2, todos };
}

export function saveListTodos(listId: string, doc: { version: 2; todos: EditorTodo[] }): { success: boolean; error?: string } {
  const database = openDatabase();
  try {
    // replace list todos atomically
    const del = database.prepare('DELETE FROM todos WHERE list_id = ?');
    const ins = database.prepare(
      'INSERT INTO todos (list_id, id, text, completed, indent, order_index) VALUES (@list_id, @id, @text, @completed, @indent, @order_index)'
    );
    const ensureList = database.prepare('SELECT id FROM lists WHERE id = ?');
    const createList = database.prepare(
      'INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    const countExisting = database.prepare('SELECT COUNT(*) as c FROM todos WHERE list_id = ?');

    // If DB already has rows and incoming doc looks like a seed/placeholder (<=1 empty row), skip to avoid wiping data
    try {
      const row = countExisting.get(listId) as any;
      const existingCount = Number(row?.c ?? 0);
      const looksLikeSeed = Array.isArray(doc.todos)
        && doc.todos.length <= 1
        && doc.todos.every((t) => String(t.text ?? '').trim() === '' && !t.completed);
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
    // Force WAL checkpoint after each save to ensure data persistence
    database.pragma('wal_checkpoint(FULL)');
    return { success: true };
  } catch (e: any) {
    console.error(`[DB] Error saving todos for list ${listId}:`, e);
    return { success: false, error: e?.message || String(e) };
  }
}

export function loadAppSettings(): AppSettings {
  const database = openDatabase();
  const hideCompletedRow = database.prepare('SELECT value FROM app_settings WHERE key = ?').get('hideCompletedItems');
  return {
    hideCompletedItems: hideCompletedRow ? hideCompletedRow.value === 'true' : true,
  };
}

export function saveAppSettings(settings: AppSettings): { success: boolean; error?: string } {
  const database = openDatabase();
  try {
    const upsert = database.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)');
    const tx = database.transaction(() => {
      upsert.run('hideCompletedItems', settings.hideCompletedItems ? 'true' : 'false');
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
      const setMeta = database.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
      setMeta.run('selectedListId', listId);
      // Ensure durability similar to other writes
      database.pragma('wal_checkpoint(FULL)');
    }
  } catch (e: any) {
    console.error('[DB] Error setting selectedListId in meta:', e);
  }
}
