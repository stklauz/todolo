import React from 'react';
import { renderHook, act } from '@testing-library/react';
import useTodosState from '../useTodosState';
import * as storage from '../../api/storage';

// Mock the storage module
jest.mock('../../api/storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('useTodosState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful storage operations by default
    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: [],
      selectedListId: undefined,
    });
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: [],
    });
    mockStorage.saveListsIndex.mockResolvedValue(true);
    mockStorage.saveListTodos.mockResolvedValue(true);
    mockStorage.duplicateList.mockResolvedValue({
      success: true,
      newListId: 'new-list-id',
    });
    mockStorage.setSelectedListMeta.mockResolvedValue();
    // New persistent delete API
    mockStorage.deleteList.mockResolvedValue({ success: true });
  });

  it('should initialize with empty state', async () => {
    const { result } = renderHook(() => useTodosState());

    // Wait for effects to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Should have default list created
    expect(result.current.lists).toHaveLength(1);
    expect(result.current.lists[0].name).toBe('My Todos');
    expect(result.current.selectedListId).toBe(result.current.lists[0].id);
  });

  it('should create default list when none exist', async () => {
    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      // Wait for the effect to run
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.lists).toHaveLength(1);
    expect(result.current.lists[0].name).toBe('My Todos');
    expect(result.current.selectedListId).toBe(result.current.lists[0].id);
  });

  it('should load existing lists', async () => {
    const mockLists = [
      {
        id: 'list-1',
        name: 'Test List',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: mockLists,
      selectedListId: 'list-1',
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.lists).toHaveLength(1);
    expect(result.current.lists[0].name).toBe('Test List');
    expect(result.current.selectedListId).toBe('list-1');
  });

  it('should add new list', async () => {
    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const initialLength = result.current.lists.length;

    act(() => {
      result.current.addList();
    });

    expect(result.current.lists).toHaveLength(initialLength + 1);
    expect(result.current.lists[initialLength].name).toBe(
      `List ${initialLength + 1}`,
    );
  });

  it('should delete list', async () => {
    const mockLists = [
      { id: 'list-1', name: 'List 1', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'list-2', name: 'List 2', createdAt: '2024-01-01T00:00:00.000Z' },
    ];
    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: mockLists,
      selectedListId: 'list-1',
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.deleteList('list-1');
    });

    expect(result.current.lists).toHaveLength(1);
    expect(result.current.lists[0].id).toBe('list-2');
    expect(result.current.selectedListId).toBe('list-2');
  });

  it('should not delete only list', async () => {
    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const initialLength = result.current.lists.length;

    act(() => {
      result.current.deleteList(result.current.lists[0].id);
    });

    expect(result.current.lists).toHaveLength(initialLength);
  });

  it('should update todo text', async () => {
    const mockTodos = [
      { id: 1, text: 'Original text', completed: false, indent: 0 },
    ];
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: mockTodos,
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateTodo(1, 'Updated text');
    });

    const todos = result.current.getSelectedTodos();
    expect(todos[0].text).toBe('Updated text');
  });

  it('should toggle todo completion', async () => {
    const mockTodos = [
      { id: 1, text: 'Test todo', completed: false, indent: 0 },
    ];
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: mockTodos,
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.toggleTodo(1);
    });

    const todos = result.current.getSelectedTodos();
    expect(todos[0].completed).toBe(true);
  });

  it('should insert todo below', async () => {
    const mockTodos = [
      { id: 1, text: 'First todo', completed: false, indent: 0 },
    ];
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: mockTodos,
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let newId: number;
    act(() => {
      newId = result.current.insertTodoBelow(0, 'New todo');
    });

    const todos = result.current.getSelectedTodos();
    expect(todos).toHaveLength(2);
    expect(todos[1].text).toBe('New todo');
    expect(todos[1].id).toBe(newId!);
  });

  it('should change todo indent', async () => {
    const mockTodos = [
      { id: 1, text: 'Test todo', completed: false, indent: 0 },
    ];
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: mockTodos,
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.changeIndent(1, 1);
    });

    const todos = result.current.getSelectedTodos();
    expect(todos[0].indent).toBe(1);
  });

  it('should clamp indent to valid range', async () => {
    const mockTodos = [
      { id: 1, text: 'Test todo', completed: false, indent: 0 },
    ];
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: mockTodos,
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.changeIndent(1, -1); // Try to go below 0
    });

    const todos = result.current.getSelectedTodos();
    expect(todos[0].indent).toBe(0);

    act(() => {
      result.current.changeIndent(1, 5); // Try to go above 1
    });

    const todosAfter = result.current.getSelectedTodos();
    expect(todosAfter[0].indent).toBe(1);
  });

  it('should duplicate list successfully', async () => {
    const mockLists = [
      { id: '1', name: 'Original List', createdAt: '2024-01-01T00:00:00.000Z' },
    ];
    const mockUpdatedLists = [
      { id: '1', name: 'Original List', createdAt: '2024-01-01T00:00:00.000Z' },
      {
        id: 'new-list-id',
        name: 'Original List (Copy)',
        createdAt: '2024-01-02T00:00:00.000Z',
      },
    ];

    mockStorage.loadListsIndex
      .mockResolvedValueOnce({
        version: 2,
        lists: mockLists,
        selectedListId: '1',
      })
      .mockResolvedValueOnce({
        version: 2,
        lists: mockUpdatedLists,
        selectedListId: 'new-list-id',
      });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let newListId: string | null = null;
    await act(async () => {
      newListId = await result.current.duplicateList('1');
    });

    expect(newListId).toBe('new-list-id');
    expect(mockStorage.duplicateList).toHaveBeenCalledWith('1', undefined);
    expect(mockStorage.loadListsIndex).toHaveBeenCalledTimes(1); // Only once on init, not after duplicate
    expect(mockStorage.setSelectedListMeta).toHaveBeenCalledWith('new-list-id');
  });

  it('should duplicate list with completed todos properly mirrored', async () => {
    const mockLists = [
      { id: '1', name: 'Original List', createdAt: '2024-01-01T00:00:00.000Z' },
    ];

    // Mock the source list with some completed todos
    const sourceTodos = [
      { id: 1, text: 'Task 1', completed: true, indent: 0 },
      { id: 2, text: 'Task 2', completed: false, indent: 0 },
      { id: 3, text: 'Task 3', completed: true, indent: 0 },
    ];

    // Mock the duplicated list todos (should mirror the source)
    const duplicatedTodos = [
      { id: 1, text: 'Task 1', completed: true, indent: 0 },
      { id: 2, text: 'Task 2', completed: false, indent: 0 },
      { id: 3, text: 'Task 3', completed: true, indent: 0 },
    ];

    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: mockLists,
      selectedListId: '1',
    });

    // Mock loadListTodos for the duplicated list
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: duplicatedTodos,
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let newListId: string | null = null;
    await act(async () => {
      newListId = await result.current.duplicateList('1');
    });

    expect(newListId).toBe('new-list-id');
    expect(mockStorage.duplicateList).toHaveBeenCalledWith('1', undefined);
    expect(mockStorage.loadListTodos).toHaveBeenCalledWith('new-list-id');
    expect(mockStorage.setSelectedListMeta).toHaveBeenCalledWith('new-list-id');

    // Verify the duplicated list has the correct todos with completion status
    const duplicatedList = result.current.lists.find(
      (l) => l.id === 'new-list-id',
    );
    expect(duplicatedList).toBeDefined();
    expect(duplicatedList?.todos).toHaveLength(3);
    expect(duplicatedList?.todos[0].completed).toBe(true);
    expect(duplicatedList?.todos[1].completed).toBe(false);
    expect(duplicatedList?.todos[2].completed).toBe(true);
  });

  it('should mirror completion when toggled then immediately duplicated', async () => {
    // Start with one list selected
    const mockLists = [
      { id: '1', name: 'Original List', createdAt: '2024-01-01T00:00:00.000Z' },
    ];
    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: mockLists,
      selectedListId: '1',
    });

    // When duplicating, the hook will load todos for the new list id
    mockStorage.loadListTodos.mockResolvedValue({ version: 2, todos: [] });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Build current list state entirely through the public API
    act(() => {
      result.current.insertTodoBelow(0, 'Task 1');
      result.current.insertTodoBelow(1, 'Task 2');
    });

    // Toggle completion of the 'Task 1' todo (not the seed)
    act(() => {
      const todos = result.current.getSelectedTodos();
      const task1 = todos.find((t) => t.text === 'Task 1');
      expect(task1).toBeDefined();
      result.current.toggleTodo(task1!.id);
    });

    // Prepare duplicated list payload to mirror current state
    const currentTodos = result.current.getSelectedTodos();
    mockStorage.loadListTodos.mockResolvedValueOnce({
      version: 2,
      todos: currentTodos.map((t) => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        indent: t.indent as number,
      })),
    });

    let newListId: string | null = null;
    await act(async () => {
      newListId = await result.current.duplicateList('1');
    });

    expect(newListId).toBe('new-list-id');

    const duplicated = result.current.lists.find((l) => l.id === 'new-list-id');
    expect(duplicated).toBeDefined();
    expect((duplicated?.todos || []).length).toBeGreaterThanOrEqual(2);
    // Because seed behavior may exist, assert by matching by text
    const byText: Record<string, boolean> = Object.fromEntries(
      (duplicated?.todos || []).map((t) => [t.text, t.completed]),
    );
    expect(byText['Task 1']).toBe(true);
    expect(byText['Task 2']).toBe(false);
  });

  it('should force save before duplicating current list to prevent race conditions', async () => {
    const mockLists = [
      { id: '1', name: 'Original List', createdAt: '2024-01-01T00:00:00.000Z' },
    ];

    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: mockLists,
      selectedListId: '1',
    });

    // Mock loadListTodos for the duplicated list
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: [
        { id: 1, text: 'Task 1', completed: true, indent: 0 },
        { id: 2, text: 'Task 2', completed: false, indent: 0 },
      ],
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Mock saveListTodos to control resolution and assert ordering
    let resolveSave!: () => void;
    const savePromise = new Promise<boolean>((resolve) => {
      resolveSave = () => resolve(true);
    });
    const saveListTodosSpy = jest.fn().mockImplementation(() => savePromise);
    mockStorage.saveListTodos = saveListTodosSpy as any;

    const duplicateSpy = jest
      .spyOn(mockStorage, 'duplicateList')
      .mockResolvedValue({ success: true, newListId: 'new-list-id' });

    let newListId: string | null = null;
    const dupPromise = act(async () => {
      newListId = await result.current.duplicateList('1');
    });

    // Ensure duplicate isn't invoked before save resolves
    expect(duplicateSpy).not.toHaveBeenCalled();

    // Resolve save and allow flow to continue
    resolveSave();
    await dupPromise;

    expect(newListId).toBe('new-list-id');
    expect(mockStorage.duplicateList).toHaveBeenCalledWith('1', undefined);

    // Verify that save was called and awaited before duplicate
    expect(saveListTodosSpy).toHaveBeenCalled();
    expect(duplicateSpy).toHaveBeenCalledWith('1', undefined);

    // Verify the duplicated list has the correct todos
    const duplicatedList = result.current.lists.find(
      (l) => l.id === 'new-list-id',
    );
    expect(duplicatedList).toBeDefined();
    expect(duplicatedList?.todos).toHaveLength(2);
    expect(duplicatedList?.todos[0].completed).toBe(true);
    expect(duplicatedList?.todos[1].completed).toBe(false);
  });

  it('should duplicate list with custom name', async () => {
    const mockLists = [
      { id: '1', name: 'Original List', createdAt: '2024-01-01T00:00:00.000Z' },
    ];
    const mockUpdatedLists = [
      { id: '1', name: 'Original List', createdAt: '2024-01-01T00:00:00.000Z' },
      {
        id: 'new-list-id',
        name: 'My Custom Name',
        createdAt: '2024-01-02T00:00:00.000Z',
      },
    ];

    mockStorage.loadListsIndex
      .mockResolvedValueOnce({
        version: 2,
        lists: mockLists,
        selectedListId: '1',
      })
      .mockResolvedValueOnce({
        version: 2,
        lists: mockUpdatedLists,
        selectedListId: 'new-list-id',
      });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let newListId: string | null = null;
    await act(async () => {
      newListId = await result.current.duplicateList('1', 'My Custom Name');
    });

    expect(newListId).toBe('new-list-id');
    expect(mockStorage.duplicateList).toHaveBeenCalledWith(
      '1',
      'My Custom Name',
    );
  });

  it('should return null when duplication fails', async () => {
    mockStorage.duplicateList.mockResolvedValue({
      success: false,
      error: 'not_found',
    });

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let newListId: string | null = null;
    await act(async () => {
      newListId = await result.current.duplicateList('non-existent');
    });

    expect(newListId).toBe(null);
    expect(mockStorage.duplicateList).toHaveBeenCalledWith(
      'non-existent',
      undefined,
    );
    expect(mockStorage.loadListsIndex).toHaveBeenCalledTimes(1); // Only on init, not after failed duplicate
  });

  it('should handle duplication errors gracefully', async () => {
    mockStorage.duplicateList.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTodosState());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let newListId: string | null = null;
    await act(async () => {
      newListId = await result.current.duplicateList('1');
    });

    expect(newListId).toBe(null);
  });
});
