import { renderHook } from '@testing-library/react';
import type { EditorTodo } from '../types';
import useTodosOperations from '../hooks/useTodosOperations';

function setup(
  initialTodos: EditorTodo[] = [
    { id: 1, text: 'a', completed: false, indent: 0 },
  ],
) {
  let todos = [...initialTodos];
  const setSelectedTodos = (updater: (prev: typeof todos) => typeof todos) => {
    const next = updater(todos);
    if (next) todos = next as typeof todos;
  };
  const saveWithStrategy = jest.fn();
  const nextId = () => Math.max(0, ...todos.map((t) => t.id)) + 1;

  const { result } = renderHook(() =>
    useTodosOperations({
      setSelectedTodos: setSelectedTodos as any,
      saveWithStrategy: saveWithStrategy as any,
      nextId,
    }),
  );

  return {
    ops: result.current,
    saveWithStrategy,
    getTodos: () => todos,
  };
}

describe('useTodosOperations - save strategy', () => {
  it('toggleTodo uses debounced(75ms)', () => {
    const { ops, saveWithStrategy } = setup();
    ops.toggleTodo(1);
    expect(saveWithStrategy).toHaveBeenCalledWith('debounced', 75);
  });

  it('insertTodoBelow uses debounced(75ms)', () => {
    const { ops, saveWithStrategy } = setup();
    ops.insertTodoBelow(0, 'x');
    expect(saveWithStrategy).toHaveBeenCalledWith('debounced', 75);
  });

  it('removeTodoAt uses debounced(75ms)', () => {
    const { ops, saveWithStrategy } = setup();
    ops.removeTodoAt(0);
    expect(saveWithStrategy).toHaveBeenCalledWith('debounced', 75);
  });
});
describe('useTodosOperations - parentId normalization', () => {
  it('setIndent keeps parentId null when no parent candidate exists', () => {
    const { ops, getTodos } = setup([
      { id: 1, text: 'orphan', completed: false, indent: 0, parentId: null },
    ]);

    ops.setIndent(1, 1);

    const target = getTodos().find((t) => t.id === 1);
    expect(target?.indent).toBe(1);
    expect(target?.parentId).toBeNull();
  });

  it('changeIndent keeps parentId null when no parent candidate exists', () => {
    const { ops, getTodos } = setup([
      { id: 1, text: 'root', completed: false, indent: 0, parentId: null },
    ]);

    ops.changeIndent(1, +1);

    const target = getTodos().find((t) => t.id === 1);
    expect(target?.indent).toBe(1);
    expect(target?.parentId).toBeNull();
  });
});
