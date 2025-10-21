import { renderHook } from '@testing-library/react';
import useTodosOperations from '../hooks/useTodosOperations';

describe('useTodosOperations - save strategy', () => {
  function setup(
    initialTodos = [{ id: 1, text: 'a', completed: false, indent: 0 }],
  ) {
    let todos = [...initialTodos];
    const setSelectedTodos = (
      updater: (prev: typeof todos) => typeof todos,
    ) => {
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

    return { ops: result.current, saveWithStrategy };
  }

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
