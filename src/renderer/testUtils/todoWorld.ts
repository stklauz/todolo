import { renderHook, act } from '@testing-library/react';
import useTodosState from '../features/todos/hooks/useTodosState';
import * as storage from '../features/todos/api/storage';

export type Position = 'begin' | 'middle' | 'end';
export type Visibility = 'all' | 'active' | 'completed';

export function setupStorage(
  overrides?: Partial<Record<keyof typeof storage, any>>,
) {
  const mockStorage = storage as jest.Mocked<typeof storage>;
  jest.clearAllMocks();
  mockStorage.loadAppSettings.mockResolvedValue({ hideCompletedItems: true });
  mockStorage.loadListsIndex.mockResolvedValue({
    version: 2,
    lists: [
      {
        id: 'list-1',
        name: 'My Todos',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    selectedListId: 'list-1',
  });
  mockStorage.loadListTodos.mockResolvedValue({ version: 3, todos: [] });
  mockStorage.saveListsIndex.mockResolvedValue(true);
  mockStorage.saveListTodos.mockResolvedValue(true);
  mockStorage.duplicateList.mockResolvedValue({
    success: true,
    newListId: 'new-list-id',
  });
  mockStorage.setSelectedListMeta.mockResolvedValue();
  if (overrides) {
    Object.entries(overrides).forEach(([k, v]) => {
      (mockStorage as unknown as Record<string, unknown>)[k] = v as unknown;
    });
  }
  return mockStorage;
}

export function createWorld(overrides?: Parameters<typeof setupStorage>[0]) {
  setupStorage(overrides);

  const hook = renderHook(() => useTodosState());

  async function ready() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function list() {
    return hook.result.current.getSelectedTodos();
  }

  function addAt(position: Position, text: string) {
    const todos = list();
    if (todos.length === 0) {
      let id!: number;
      act(() => {
        id = hook.result.current.insertTodoBelow(-1 as unknown as number, text);
      });
      return id;
    }

    const index =
      position === 'begin'
        ? 0
        : position === 'end'
          ? todos.length - 1
          : Math.floor((todos.length - 1) / 2);

    let id!: number;
    act(() => {
      id = hook.result.current.insertTodoBelow(index, text);
    });
    return id;
  }

  function edit(index: number, text: string) {
    const todos = list();
    const id = todos[index]?.id;
    if (id == null) return;
    act(() => hook.result.current.updateTodo(id, text));
  }

  function editById(id: number, text: string) {
    act(() => hook.result.current.updateTodo(id, text));
  }

  function toggle(index: number) {
    const id = list()[index]?.id;
    if (id == null) return;
    act(() => hook.result.current.toggleTodo(id));
  }

  function toggleById(id: number) {
    act(() => hook.result.current.toggleTodo(id));
  }

  function remove(index: number) {
    act(() => hook.result.current.removeTodoAt(index));
  }

  function removeById(id: number) {
    const idx = list().findIndex((t) => t.id === id);
    if (idx >= 0) {
      act(() => hook.result.current.removeTodoAt(idx));
    }
  }

  function visible(filter: Visibility) {
    const todos = list();
    if (filter === 'all') return todos;
    if (filter === 'active') return todos.filter((t) => !t.completed);
    return todos.filter((t) => t.completed);
  }

  function get(index: number) {
    return list()[index];
  }

  function getById(id: number) {
    return list().find((t) => t.id === id);
  }

  function ids() {
    return list().map((t) => t.id);
  }

  function maxId() {
    const arr = ids();
    return arr.length ? Math.max(...arr) : 0;
  }

  async function duplicateCurrent(
    newListTodos?: Array<{
      id: number;
      text: string;
      completed: boolean;
      indent?: number;
    }>,
  ) {
    const mockStorage = storage as jest.Mocked<typeof storage>;
    if (newListTodos) {
      mockStorage.loadListTodos.mockResolvedValueOnce({
        version: 3,
        todos: newListTodos,
      });
    }
    let newId: string | null = null;
    await act(async () => {
      newId = await hook.result.current.duplicateList(
        hook.result.current.selectedListId!,
      );
    });
    return newId;
  }

  return {
    hook,
    ready,
    list,
    addAt,
    edit,
    editById,
    toggle,
    toggleById,
    remove,
    removeById,
    visible,
    duplicateCurrent,
    ids,
    maxId,
    get,
    getById,
  };
}
