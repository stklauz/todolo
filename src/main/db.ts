import path from 'path';
import { app } from 'electron';
import fs from 'fs';

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

type DB = any;
let db: DB | null = null;

const getUserDataDir = () => app.getPath('userData');

function getDbPath() {
  const dir = getUserDataDir();
  console.log(`[DB] UserData directory: ${dir}`);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  const dbPath = path.join(dir, 'todolo.db');
  console.log(`[DB] Database path: ${dbPath}`);
  return dbPath;
}

export function openDatabase(): DB {
  if (db) {
    console.log(`[DB] Reusing existing database connection`);
    return db;
  }
  const dbPath = getDbPath();
  console.log(`[DB] Opening database at: ${dbPath}`);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  applyMigrations(db);
  return db;
}

export function closeDatabase(): void {
  if (db) {
    try {
      // Force WAL checkpoint to ensure all data is written to main database
      db.pragma('wal_checkpoint(FULL)');
      db.close();
    } catch (error) {
      console.error('Error closing database:', error);
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
  database.exec(`${createMeta}${createLists}${createTodos}`);
}

export function loadListsIndex(): ListsIndexV2 {
  const database = openDatabase();
  const lists = database.prepare('SELECT id, name, created_at as createdAt, updated_at as updatedAt FROM lists ORDER BY created_at ASC').all();
  const selectedRow = database.prepare('SELECT value FROM meta WHERE key = ?').get('selectedListId');
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
    const incoming = new Set(index.lists.map((l) => l.id));
    const toDelete = [...existing].filter((id) => !incoming.has(id));
    const upsertList = database.prepare(
      'INSERT OR REPLACE INTO lists (id, name, created_at, updated_at) VALUES (@id, @name, @created_at, @updated_at)'
    );
    const delTodos = database.prepare('DELETE FROM todos WHERE list_id = ?');
    const delList = database.prepare('DELETE FROM lists WHERE id = ?');
    const setMeta = database.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
    const tx = database.transaction(() => {
      for (const id of toDelete) {
        delTodos.run(id);
        delList.run(id);
      }
      for (const l of index.lists) {
        upsertList.run({
          id: l.id,
          name: l.name,
          created_at: l.createdAt,
          updated_at: l.updatedAt ?? null,
        });
      }
      setMeta.run('selectedListId', index.selectedListId ?? '');
    });
    tx();
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
    console.log(`[DB] Saving todos for list ${listId} (count=${doc.todos.length})`);
    const del = database.prepare('DELETE FROM todos WHERE list_id = ?');
    const ins = database.prepare(
      'INSERT INTO todos (list_id, id, text, completed, indent, order_index) VALUES (@list_id, @id, @text, @completed, @indent, @order_index)'
    );
    const tx = database.transaction(() => {
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
    console.log(`[DB] Saved ${doc.todos.length} todos for list ${listId}`);
    return { success: true };
  } catch (e: any) {
    console.error(`[DB] Error saving todos for list ${listId}:`, e);
    return { success: false, error: e?.message || String(e) };
  }
}
