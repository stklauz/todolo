import path from 'path';
import fs from 'fs';
import { app } from 'electron';

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
const getDataDir = () => path.join(getUserDataDir(), 'data');
const getLegacyTodosPath = () => path.join(getUserDataDir(), 'todos.json');
const getListsIndexPath = () => path.join(getDataDir(), 'lists.json');
const getListTodosPath = (listId: string) => path.join(getDataDir(), `list-${listId}.json`);

const ensureDir = (p: string) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

function getDbPath() {
  ensureDir(getUserDataDir());
  return path.join(getUserDataDir(), 'todolo.db');
}

export function openDatabase(): DB {
  if (db) return db;
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  applyMigrations(db);
  maybeMigrateFromJson(db);
  return db;
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

function maybeMigrateFromJson(database: DB) {
  // If we already have lists, assume migrated
  const row = database.prepare('SELECT COUNT(1) AS c FROM lists').get();
  if (row && row.c > 0) return;

  // Prefer new per-list layout if present
  const listsPath = getListsIndexPath();
  if (fs.existsSync(listsPath)) {
    try {
      const raw = fs.readFileSync(listsPath, 'utf-8');
      const indexDoc = JSON.parse(raw) as ListsIndexV2;
      if (indexDoc && indexDoc.version === 2 && Array.isArray(indexDoc.lists)) {
        const insertList = database.prepare(
          'INSERT OR REPLACE INTO lists (id, name, created_at, updated_at) VALUES (@id, @name, @created_at, @updated_at)'
        );
        const insertTodo = database.prepare(
          'INSERT INTO todos (list_id, id, text, completed, indent, order_index) VALUES (@list_id, @id, @text, @completed, @indent, @order_index)'
        );
        const tx = database.transaction(() => {
          for (const l of indexDoc.lists) {
            insertList.run({
              id: l.id,
              name: l.name,
              created_at: l.createdAt,
              updated_at: l.updatedAt ?? null,
            });
            const listTodosPath = getListTodosPath(l.id);
            if (fs.existsSync(listTodosPath)) {
              try {
                const rawTodos = fs.readFileSync(listTodosPath, 'utf-8');
                const doc = JSON.parse(rawTodos) as { version: 2; todos: EditorTodo[] };
                if (doc && Array.isArray(doc.todos)) {
                  let idx = 0;
                  for (const t of doc.todos) {
                    insertTodo.run({
                      list_id: l.id,
                      id: t.id,
                      text: t.text,
                      completed: t.completed ? 1 : 0,
                      indent: Number(t.indent ?? 0),
                      order_index: idx++,
                    });
                  }
                }
              } catch (e) {
                // ignore this list on failure
              }
            }
          }
          // selected list
          database
            .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
            .run('selectedListId', indexDoc.selectedListId ?? '');
        });
        tx();
        return;
      }
    } catch (e) {
      // fall through to legacy
    }
  }

  // Legacy single-file migration
  const legacyPath = getLegacyTodosPath();
  if (fs.existsSync(legacyPath)) {
    try {
      const rawLegacy = fs.readFileSync(legacyPath, 'utf-8');
      const parsed = JSON.parse(rawLegacy);
      const insertList = database.prepare(
        'INSERT OR REPLACE INTO lists (id, name, created_at, updated_at) VALUES (@id, @name, @created_at, @updated_at)'
      );
      const insertTodo = database.prepare(
        'INSERT INTO todos (list_id, id, text, completed, indent, order_index) VALUES (@list_id, @id, @text, @completed, @indent, @order_index)'
      );
      const tx = database.transaction(() => {
        if (Array.isArray(parsed)) {
          const id = `${Date.now()}`;
          const now = new Date().toISOString();
          insertList.run({ id, name: 'My Todos', created_at: now, updated_at: now });
          let idx = 0;
          for (const t of parsed as EditorTodo[]) {
            insertTodo.run({
              list_id: id,
              id: t.id,
              text: t.text,
              completed: t.completed ? 1 : 0,
              indent: Number(t.indent ?? 0),
              order_index: idx++,
            });
          }
          database.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('selectedListId', id);
        } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).lists)) {
          const lists = (parsed as any).lists as Array<{ id?: string; name?: string; createdAt?: string; updatedAt?: string; todos?: EditorTodo[] }>;
          for (let i = 0; i < lists.length; i++) {
            const l = lists[i];
            const id = typeof l.id === 'string' ? l.id : String(i + 1);
            insertList.run({
              id,
              name: typeof l.name === 'string' ? l.name : `List ${i + 1}`,
              created_at: l.createdAt || new Date().toISOString(),
              updated_at: l.updatedAt || l.createdAt || null,
            });
            let idx = 0;
            for (const t of Array.isArray(l.todos) ? l.todos : []) {
              insertTodo.run({
                list_id: id,
                id: t.id,
                text: t.text,
                completed: t.completed ? 1 : 0,
                indent: Number(t.indent ?? 0),
                order_index: idx++,
              });
            }
          }
          const sel = (parsed as any).selectedListId ?? '';
          database.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('selectedListId', sel);
        }
      });
      tx();
    } catch (e) {
      // ignore
    }
  }
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
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

