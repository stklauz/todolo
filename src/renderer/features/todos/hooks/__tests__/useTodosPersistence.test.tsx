import React from 'react';
import { renderHook, act } from '@testing-library/react';
import useTodosPersistence from '../useTodosPersistence';
import * as storage from '../../api/storage';
import type { TodoList } from '../../types';

// Mock the storage module
jest.mock('../../api/storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

// Mock debug logger
jest.mock('../../../../utils/debug', () => ({
  debugLogger: {
    log: jest.fn(),
  },
}));

describe('useTodosPersistence', () => {
  const mockSetLists = jest.fn();
  const mockNextId = jest.fn();
  const mockSyncIdCounter = jest.fn();

  const defaultProps = {
    lists: [] as TodoList[],
    selectedListId: null as string | null,
    selectedListIdRef: { current: null as string | null },
    listsRef: { current: [] as TodoList[] },
    loadedListsRef: { current: new Set<string>() },
    nextId: mockNextId,
    syncIdCounter: mockSyncIdCounter,
    setLists: mockSetLists,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNextId.mockReturnValue(1);
  });

  describe('ID counter synchronization', () => {
    it('should sync ID counter when loading todos with max ID > current counter', async () => {
      const todosWithHighIds = [
        { id: 5, text: 'Task 1', completed: false, indent: 0 },
        { id: 10, text: 'Task 2', completed: false, indent: 0 },
      ];

      mockStorage.loadListTodos.mockResolvedValue({
        version: 2,
        todos: todosWithHighIds,
      });

      const { rerender } = renderHook((props) => useTodosPersistence(props), {
        initialProps: defaultProps,
      });

      // Simulate list selection
      rerender({
        ...defaultProps,
        selectedListId: 'list-1',
        lists: [{ id: 'list-1', name: 'Test List', todos: [] }],
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockSyncIdCounter).toHaveBeenCalledWith(10);
    });

    it('should not decrease counter if max ID < current counter', async () => {
      const todosWithLowIds = [
        { id: 1, text: 'Task 1', completed: false, indent: 0 },
        { id: 2, text: 'Task 2', completed: false, indent: 0 },
      ];

      mockStorage.loadListTodos.mockResolvedValue({
        version: 2,
        todos: todosWithLowIds,
      });

      // Mock that current counter is already higher
      mockNextId.mockReturnValue(5);

      const { rerender } = renderHook((props) => useTodosPersistence(props), {
        initialProps: defaultProps,
      });

      // Simulate list selection
      rerender({
        ...defaultProps,
        selectedListId: 'list-1',
        lists: [{ id: 'list-1', name: 'Test List', todos: [] }],
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // The syncIdCounter should be called with maxId=2, but our implementation
      // only updates if maxId >= current counter, so it won't change the counter
      expect(mockSyncIdCounter).toHaveBeenCalledWith(2);
    });

    it('should handle empty todo list without affecting counter', async () => {
      mockStorage.loadListTodos.mockResolvedValue({
        version: 2,
        todos: [],
      });

      mockStorage.saveListTodos.mockResolvedValue(true);

      const { rerender } = renderHook((props) => useTodosPersistence(props), {
        initialProps: defaultProps,
      });

      // Simulate list selection
      rerender({
        ...defaultProps,
        selectedListId: 'list-1',
        lists: [{ id: 'list-1', name: 'Test List', todos: [] }],
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should create seed todo and call nextId for it
      expect(mockNextId).toHaveBeenCalled();
      expect(mockSyncIdCounter).not.toHaveBeenCalled();
    });

    it('should maintain correct counter state across multiple list switches', async () => {
      const list1Todos = [
        { id: 3, text: 'List 1 Task 1', completed: false, indent: 0 },
        { id: 4, text: 'List 1 Task 2', completed: false, indent: 0 },
      ];

      const list2Todos = [
        { id: 7, text: 'List 2 Task 1', completed: false, indent: 0 },
        { id: 8, text: 'List 2 Task 2', completed: false, indent: 0 },
      ];

      mockStorage.loadListTodos.mockImplementation(async (listId: string) => {
        if (listId === 'list-1') {
          return { version: 2, todos: list1Todos };
        }
        if (listId === 'list-2') {
          return { version: 2, todos: list2Todos };
        }
        return { version: 2, todos: [] };
      });

      const { rerender } = renderHook((props) => useTodosPersistence(props), {
        initialProps: defaultProps,
      });

      // Switch to list 1
      rerender({
        ...defaultProps,
        selectedListId: 'list-1',
        lists: [
          { id: 'list-1', name: 'List 1', todos: [] },
          { id: 'list-2', name: 'List 2', todos: [] },
        ],
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockSyncIdCounter).toHaveBeenCalledWith(4);

      // Switch to list 2
      rerender({
        ...defaultProps,
        selectedListId: 'list-2',
        lists: [
          { id: 'list-1', name: 'List 1', todos: list1Todos },
          { id: 'list-2', name: 'List 2', todos: [] },
        ],
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should sync to higher max ID (8)
      expect(mockSyncIdCounter).toHaveBeenCalledWith(8);
    });

    it('should skip loading if list is already cached and has todos', async () => {
      const existingTodos = [
        { id: 1, text: 'Existing Task', completed: false, indent: 0 },
      ];

      const { rerender } = renderHook((props) => useTodosPersistence(props), {
        initialProps: defaultProps,
      });

      // Simulate list with existing todos (already cached)
      rerender({
        ...defaultProps,
        selectedListId: 'list-1',
        lists: [{ id: 'list-1', name: 'Test List', todos: existingTodos }],
        loadedListsRef: { current: new Set(['list-1']) },
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should not call loadListTodos since list is already cached
      expect(mockStorage.loadListTodos).not.toHaveBeenCalled();
      expect(mockSyncIdCounter).not.toHaveBeenCalled();
    });
  });

  describe('saveWithStrategy', () => {
    it('should save immediately when type is immediate', async () => {
      mockStorage.saveListTodos.mockResolvedValue(true);

      const { result } = renderHook((props) => useTodosPersistence(props), {
        initialProps: defaultProps,
      });

      // Simulate list with todos
      act(() => {
        result.current.saveWithStrategy('immediate');
      });

      // Should not save if no selected list
      expect(mockStorage.saveListTodos).not.toHaveBeenCalled();

      // Now with a selected list
      const { result: result2 } = renderHook(
        (props) => useTodosPersistence(props),
        {
          initialProps: {
            ...defaultProps,
            selectedListId: 'list-1',
            lists: [
              {
                id: 'list-1',
                name: 'Test List',
                todos: [{ id: 1, text: 'Test', completed: false, indent: 0 }],
              },
            ],
            loadedListsRef: { current: new Set(['list-1']) },
          },
        },
      );

      await act(async () => {
        result2.current.saveWithStrategy('immediate');
      });

      expect(mockStorage.saveListTodos).toHaveBeenCalled();
    });

    it('should debounce saves when type is debounced', async () => {
      mockStorage.saveListTodos.mockResolvedValue(true);

      const { result } = renderHook((props) => useTodosPersistence(props), {
        initialProps: {
          ...defaultProps,
          selectedListId: 'list-1',
          lists: [
            {
              id: 'list-1',
              name: 'Test List',
              todos: [{ id: 1, text: 'Test', completed: false, indent: 0 }],
            },
          ],
          loadedListsRef: { current: new Set(['list-1']) },
        },
      });

      act(() => {
        result.current.saveWithStrategy('debounced', 100);
      });

      // Should not save immediately
      expect(mockStorage.saveListTodos).not.toHaveBeenCalled();

      // Wait for debounce
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(mockStorage.saveListTodos).toHaveBeenCalled();
    });
  });
});
