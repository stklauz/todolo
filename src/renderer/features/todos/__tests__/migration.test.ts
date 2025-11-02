import type { EditorTodo } from '../types';
import { runTodosMigration, inferParentIds } from '../utils/migration';

const t = (
  id: number,
  text: string,
  completed = false,
  indent = 0,
): EditorTodo => ({
  id,
  text,
  completed,
  indent,
});

describe('Todos migration', () => {
  test('infers parentId by indent scanning', () => {
    const todos: EditorTodo[] = [
      t(1, 'A', false, 0),
      t(2, 'A.1', false, 1),
      t(3, 'A.2', true, 1),
      t(4, 'B', false, 0),
      t(5, 'B.1', true, 1),
    ];

    const withParents = inferParentIds(todos);
    expect(withParents[0].parentId).toBeNull();
    expect(withParents[1].parentId).toBe(1);
    expect(withParents[2].parentId).toBe(1);
    expect(withParents[3].parentId).toBeNull();
    expect(withParents[4].parentId).toBe(4);
  });

  test('enforces invariant: active children cannot have completed parents', () => {
    // Parent completed, child active => child should be reparented to nearest previous active parent or null
    const todos: EditorTodo[] = [
      t(1, 'A', false, 0),
      t(2, 'A.1', false, 1),
      t(3, 'B', true, 0), // completed parent
      t(4, 'B.1', false, 1), // active child under completed parent -> should move under A (nearest active parent)
      t(5, 'C', true, 0),
      t(6, 'C.1', false, 1), // active child under completed parent -> should move under A as well
    ];

    const { todos: migrated } = runTodosMigration(todos);
    const byId = new Map(migrated.map((x) => [x.id, x] as const));

    expect(byId.get(4)?.parentId).toBe(1);
    expect(byId.get(6)?.parentId).toBe(1);
  });

  test('reparents to null when no previous active parent exists', () => {
    const todos: EditorTodo[] = [
      t(1, 'A', true, 0),
      t(2, 'A.1', false, 1), // should end up parentId=null
    ];

    const { todos: migrated } = runTodosMigration(todos);
    expect(migrated[1].parentId).toBeNull();
  });

  test('handles nested hierarchies with mixed completion states', () => {
    const todos: EditorTodo[] = [
      t(1, 'A', false, 0),
      t(2, 'A.1', true, 1),
      t(3, 'A.2', false, 1),
      t(4, 'B', true, 0),
      t(5, 'B.1', false, 1), // active under completed parent -> reparent to A
      t(6, 'B.1.a', false, 2), // deeper level should follow its immediate parent (after reparent)
    ];

    const { todos: migrated } = runTodosMigration(todos);
    const byId = new Map(migrated.map((x) => [x.id, x] as const));

    expect(byId.get(2)?.parentId).toBe(1);
    expect(byId.get(3)?.parentId).toBe(1);
    expect(byId.get(5)?.parentId).toBe(1);
    // After reparent of 5 to A (indent 1), 6 stays child of 5
    expect(byId.get(6)?.parentId).toBe(5);
  });

  test('infers missing parentId when column exists but values are null', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
      {
        id: 2,
        text: 'Child missing parent',
        completed: false,
        indent: 1,
        parentId: null,
      },
      {
        id: 3,
        text: 'Sibling child',
        completed: true,
        indent: 1,
        parentId: null,
      },
    ];

    const { todos: migrated } = runTodosMigration(todos);
    const byId = new Map(migrated.map((x) => [x.id, x] as const));

    expect(byId.get(2)?.parentId).toBe(1);
    expect(byId.get(3)?.parentId).toBe(1);
  });
});
