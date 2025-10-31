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
  return { ops, getState: () => state, saveWithStrategy };
}

describe('toggle using parentId/section', () => {
  it('toggling a parent updates all descendants completion and section', () => {
    const initial: EditorTodo[] = [
      {
        id: 1,
        text: 'p',
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
        text: 'gc1',
        completed: false,
        indent: 1,
        parentId: 2,
        section: 'active',
      },
      {
        id: 4,
        text: 'c2',
        completed: false,
        indent: 1,
        parentId: 1,
        section: 'active',
      },
    ];
    const { ops, getState } = setup(initial);
    ops.toggleTodo(1);
    const after = getState();
    const byId = new Map(after.map((t) => [t.id, t] as const));
    expect(byId.get(1)?.completed).toBe(true);
    expect(byId.get(1)?.section).toBe('completed');
    expect(byId.get(2)?.completed).toBe(true);
    expect(byId.get(2)?.section).toBe('completed');
    expect(byId.get(4)?.completed).toBe(true);
    expect(byId.get(4)?.section).toBe('completed');
    // grandchild also toggled
    expect(byId.get(3)?.completed).toBe(true);
    expect(byId.get(3)?.section).toBe('completed');
  });

  it('toggling a child updates its own completion and section only', () => {
    const initial: EditorTodo[] = [
      {
        id: 1,
        text: 'p',
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
    ];
    const { ops, getState } = setup(initial);
    ops.toggleTodo(2);
    const after = getState();
    const byId = new Map(after.map((t) => [t.id, t] as const));
    expect(byId.get(2)?.completed).toBe(true);
    expect(byId.get(2)?.section).toBe('completed');
    // parent unchanged
    expect(byId.get(1)?.completed).toBe(false);
    expect(byId.get(1)?.section).toBe('active');
  });
});
