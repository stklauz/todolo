import React from 'react';
import { renderHook, act } from '@testing-library/react';
import useTodosState from '../renderer/features/todos/hooks/useTodosState';
import * as storage from '../renderer/features/todos/api/storage';

// Mock the storage module
jest.mock('../renderer/features/todos/api/storage');
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

  it.skip('should not delete only list', async () => {
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
});
