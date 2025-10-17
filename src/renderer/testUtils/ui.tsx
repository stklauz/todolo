import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoApp } from '../features/todos/components/TodoApp';
import TodosProvider from '../features/todos/contexts/TodosProvider';
import * as storage from '../features/todos/api/storage';

export const mockStorage = storage as jest.Mocked<typeof storage>;

type MockOverrides = Partial<Record<keyof typeof mockStorage, any>>;

export function setupDefaultMocks(partial?: MockOverrides) {
  jest.clearAllMocks();
  mockStorage.loadAppSettings.mockResolvedValue({ hideCompletedItems: true });
  mockStorage.loadListsIndex.mockResolvedValue({
    version: 2,
    lists: [
      { id: 'list-1', name: 'My Todos', createdAt: '2024-01-01T00:00:00.000Z' },
    ],
    selectedListId: 'list-1',
  });
  mockStorage.loadListTodos.mockResolvedValue({
    version: 2,
    todos: [{ id: 1, text: '', completed: false, indent: 0 }],
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
  return render(
    <TodosProvider>
      <TodoApp />
    </TodosProvider>,
  );
}

export function setupUser() {
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}
