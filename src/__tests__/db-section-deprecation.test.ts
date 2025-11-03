/* eslint-disable @typescript-eslint/no-explicit-any */
// Verify DB layer no longer selects/writes the deprecated `section` column

jest.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
  },
}));

const prepareSqlCalls: string[] = [];

// Minimal better-sqlite3 mock capturing SQL strings
jest.mock('better-sqlite3', () => {
  return function MockDB(this: any) {
    this.exec = (_sql: string) => {};
    this.pragma = (_sql: string) => {};
    this.close = () => {};
    this.transaction = (fn: any) => fn;
    this.prepare = (sql: string) => {
      prepareSqlCalls.push(sql);
      return {
        all: () => [],
        get: () => {
          // Simulate existing source list for duplicateList flow
          if (sql.includes('SELECT name FROM lists WHERE id =')) {
            return { name: 'Source' };
          }
          // Meta lookups etc.
          return undefined;
        },
        run: () => ({}),
      };
    };
  } as any;
});
// Use require so we can keep mocks above and satisfy lint rules
const { loadListTodos, saveListTodos, duplicateList } = require('../main/db');

describe('DB: section column deprecation', () => {
  beforeEach(() => {
    prepareSqlCalls.length = 0;
  });

  test('loadListTodos SELECT does not include section', () => {
    loadListTodos('list-1');
    const select = prepareSqlCalls.find((s) => s.startsWith('SELECT')) || '';
    expect(select).toContain('SELECT id, text, completed, indent, parent_id');
    expect(select).not.toContain('section');
  });

  test('saveListTodos INSERT does not include section', () => {
    saveListTodos('list-1', {
      version: 2,
      todos: [
        {
          id: 1,
          text: 'a',
          completed: false,
          indent: 0,
          parentId: null,
        },
      ],
    });
    const insert =
      prepareSqlCalls.find((s) => s.startsWith('INSERT INTO todos')) || '';
    expect(insert).toContain(
      'INSERT INTO todos (list_id, id, text, completed, indent, order_index, parent_id)',
    );
    expect(insert).not.toContain('section');
  });

  test('duplicateList does not read/write section', () => {
    // Call function; underlying SQL will be recorded
    // We expect prepare calls for SELECT and INSERT without section
    duplicateList('source-list');
    const selects = prepareSqlCalls.filter((s) => s.startsWith('SELECT'));
    const inserts = prepareSqlCalls.filter((s) => s.startsWith('INSERT'));

    // There should be a SELECT over todos without section
    const todosSelect = selects.find((s) => s.includes('FROM todos')) || '';
    expect(todosSelect).toContain(
      'SELECT id, text, completed, indent, order_index, parent_id',
    );
    expect(todosSelect).not.toContain('section');

    // There should be an INSERT into todos without section
    const todosInsert =
      inserts.find((s) => s.startsWith('INSERT INTO todos')) || '';
    expect(todosInsert).toContain(
      'INSERT INTO todos (list_id, id, text, completed, indent, order_index, parent_id)',
    );
    expect(todosInsert).not.toContain('section');
  });
});
