import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoApp } from '../features/todos/components/TodoApp';
import * as storage from '../features/todos/api/storage';
import { useTodosStore } from '../features/todos/store/useTodosStore';

export const mockStorage = storage as jest.Mocked<typeof storage>;

type MockOverrides = Partial<Record<keyof typeof mockStorage, any>>;

export function setupDefaultMocks(partial?: MockOverrides) {
  jest.clearAllMocks();

  // Reset Zustand store to initial state for each test
  useTodosStore.setState({
    lists: [],
    selectedListId: null,
    indexLoaded: false,
    loadedLists: new Set(),
    idCounter: 1,
  });
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
  mockStorage.loadListTodos.mockResolvedValue({
    version: 3,
    todos: [{ id: 1, text: '', completed: false, indent: 0, parentId: null }],
  });
  mockStorage.saveListsIndex.mockResolvedValue(true);
  mockStorage.saveListTodos.mockResolvedValue(true);
  if (partial) {
    Object.entries(partial).forEach(([k, v]) => {
      // Cast through unknown to preserve typings while assigning
      (mockStorage as unknown as Record<string, unknown>)[k] = v as unknown;
    });
  }
}

export function renderAppWithDefaults(overrides?: MockOverrides) {
  setupDefaultMocks(overrides);
  return render(<TodoApp />);
}

export function setupUser() {
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}
