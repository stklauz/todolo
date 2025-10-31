/* eslint-disable react-hooks/rules-of-hooks */
import { describe, expect, it, jest } from '@jest/globals';
import type { EditorTodo } from '../types';
import useTodosOperations from '../hooks/useTodosOperations';

function setup(initial: EditorTodo[]) {
  let state = initial;
  const setSelectedTodos = (
    updater: (prev: EditorTodo[]) => EditorTodo[] | null | undefined,
  ) => {
    const next = updater(state);
    if (Array.isArray(next)) state = next;
  };
  const saveWithStrategy = jest.fn();
  const nextId = () => Math.max(0, ...state.map((t) => t.id)) + 1;
  const ops = useTodosOperations({
    setSelectedTodos,
    saveWithStrategy,
    nextId,
  });
  return { ops, getState: () => state };
}

describe('delete reparent/outdent behavior', () => {
  it('deleting a parent reparents children to nearest previous active parent, else outdents', () => {
    // Structure:
    // 1 (active parent)
    // 2 (active child of 1)
    // 3 (completed parent)
    // 4 (active child of 3) -> should reparent to 1 (nearest previous active parent)
    // 5 (active parent)
    const initial: EditorTodo[] = [
      {
        id: 1,
        text: 'p1',
        completed: false,
        indent: 0,
        parentId: null,
        section: 'active',
      },
      {
        id: 2,
        text: 'c1',
        completed: false,
        indent: 1,
        parentId: 1,
        section: 'active',
      },
      {
        id: 3,
        text: 'p2',
        completed: true,
        indent: 0,
        parentId: null,
        section: 'completed',
      },
      {
        id: 4,
        text: 'c2',
        completed: false,
        indent: 1,
        parentId: 3,
        section: 'active',
      },
      {
        id: 5,
        text: 'p3',
        completed: false,
        indent: 0,
        parentId: null,
        section: 'active',
      },
    ];
    const { ops, getState } = setup(initial);

    // delete index 2 => id 3 (completed parent)
    ops.removeTodoAt(2);
    const after = getState();
    const byId = new Map(after.map((t) => [t.id, t] as const));
    expect(byId.get(4)?.parentId).toBe(1);
    expect(byId.get(4)?.indent).toBe(1);
  });

  it('deleting a parent with no previous active parent outdents children to top-level', () => {
    const initial: EditorTodo[] = [
      {
        id: 10,
        text: 'only',
        completed: true,
        indent: 0,
        parentId: null,
        section: 'completed',
      },
      {
        id: 11,
        text: 'child',
        completed: false,
        indent: 1,
        parentId: 10,
        section: 'active',
      },
    ];
    const { ops, getState } = setup(initial);
    ops.removeTodoAt(0);
    const after = getState();
    const byId = new Map(after.map((t) => [t.id, t] as const));
    expect(byId.get(11)?.parentId).toBeNull();
    expect(byId.get(11)?.indent).toBe(0);
  });
});
