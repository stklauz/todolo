import React from 'react';
import { renderHook, act } from '@testing-library/react';
import useFilteredTodos from '../useFilteredTodos';
import type { EditorTodo } from '../../types';

// Mock the dependencies
const mockInsertTodoBelow = jest.fn();
const mockRemoveTodoAt = jest.fn();
const mockSetSelectedTodos = jest.fn();
const mockFocusTodo = jest.fn();

describe('useFilteredTodos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsertTodoBelow.mockReturnValue(999); // Mock new todo ID
  });

  const createMockTodos = (): EditorTodo[] => [
    { id: 1, text: 'Todo 1', completed: false, indent: 0 },
    { id: 2, text: 'Todo 2', completed: true, indent: 0 }, // Completed
    { id: 3, text: 'Todo 3', completed: false, indent: 0 },
    { id: 4, text: 'Todo 4', completed: false, indent: 0 },
  ];

  describe('insertBelowAndFocus', () => {
    it('inserts todo after correct position when completed items are hidden', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          true, // hideCompletedItems = true
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        // Insert after Todo 3 (id: 3) - should be at full list index 2
        result.current.insertBelowAndFocus(3, 'New todo');
      });

      // Should call insertTodoBelow with full list index 2 (position of Todo 3)
      expect(mockInsertTodoBelow).toHaveBeenCalledWith(2, 'New todo');
      expect(mockFocusTodo).toHaveBeenCalledWith(999);
    });

    it('inserts todo after correct position when completed items are not hidden', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          false, // hideCompletedItems = false
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        // Insert after Todo 3 (id: 3) - should be at full list index 2
        result.current.insertBelowAndFocus(3, 'New todo');
      });

      // Should call insertTodoBelow with full list index 2 (position of Todo 3)
      expect(mockInsertTodoBelow).toHaveBeenCalledWith(2, 'New todo');
      expect(mockFocusTodo).toHaveBeenCalledWith(999);
    });

    it('handles non-existent todo ID gracefully', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          true,
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        // Try to insert after non-existent todo
        result.current.insertBelowAndFocus(999, 'New todo');
      });

      // Should not call insertTodoBelow or focusTodo
      expect(mockInsertTodoBelow).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });

    it('uses empty string as default text', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          true,
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        result.current.insertBelowAndFocus(3);
      });

      expect(mockInsertTodoBelow).toHaveBeenCalledWith(2, '');
    });
  });

  describe('removeAtAndManageFocus', () => {
    it('removes todo at correct position when completed items are hidden', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          true, // hideCompletedItems = true
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        // Remove Todo 3 (id: 3) - should be at full list index 2
        result.current.removeAtAndManageFocus(3);
      });

      // Should call setSelectedTodos with updated array
      expect(mockSetSelectedTodos).toHaveBeenCalledWith(expect.any(Function));

      // Verify the updater function removes the correct todo
      const updater = mockSetSelectedTodos.mock.calls[0][0];
      const updatedTodos = updater(todos);
      expect(updatedTodos).toHaveLength(3);
      expect(updatedTodos.find((t: EditorTodo) => t.id === 3)).toBeUndefined();
    });

    it('removes todo at correct position when completed items are not hidden', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          false, // hideCompletedItems = false
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        // Remove Todo 3 (id: 3) - should be at full list index 2
        result.current.removeAtAndManageFocus(3);
      });

      // Should call setSelectedTodos with updated array
      expect(mockSetSelectedTodos).toHaveBeenCalledWith(expect.any(Function));

      // Verify the updater function removes the correct todo
      const updater = mockSetSelectedTodos.mock.calls[0][0];
      const updatedTodos = updater(todos);
      expect(updatedTodos).toHaveLength(3);
      expect(updatedTodos.find((t: EditorTodo) => t.id === 3)).toBeUndefined();
    });

    it('manages focus correctly after removal', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          true,
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        // Remove Todo 3 (id: 3) - should focus on Todo 1 (previous item)
        result.current.removeAtAndManageFocus(3);
      });

      // Should call setSelectedTodos with updated array
      expect(mockSetSelectedTodos).toHaveBeenCalledWith(expect.any(Function));

      // Verify the updater function removes the correct todo
      const updater = mockSetSelectedTodos.mock.calls[0][0];
      const updatedTodos = updater(todos);
      expect(updatedTodos).toHaveLength(3);
      expect(updatedTodos.find((t: EditorTodo) => t.id === 3)).toBeUndefined();
    });

    it('handles non-existent todo ID gracefully', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          true,
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        // Try to remove non-existent todo
        result.current.removeAtAndManageFocus(999);
      });

      // Should call setSelectedTodos but with no changes
      expect(mockSetSelectedTodos).toHaveBeenCalledWith(expect.any(Function));

      const updater = mockSetSelectedTodos.mock.calls[0][0];
      const updatedTodos = updater(todos);
      expect(updatedTodos).toEqual(todos); // Should be unchanged
    });

    it('handles removal of last todo without focus', () => {
      const singleTodo = [
        { id: 1, text: 'Only todo', completed: false, indent: 0 },
      ];
      const { result } = renderHook(() =>
        useFilteredTodos(
          singleTodo,
          true,
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      act(() => {
        result.current.removeAtAndManageFocus(1);
      });

      // Should call setSelectedTodos with empty array
      expect(mockSetSelectedTodos).toHaveBeenCalledWith(expect.any(Function));

      const updater = mockSetSelectedTodos.mock.calls[0][0];
      const updatedTodos = updater(singleTodo);
      expect(updatedTodos).toHaveLength(0);

      // Should not call focusTodo when no todos remain
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });
  });

  describe('filteredTodos', () => {
    it('filters out completed todos when hideCompletedItems is true', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          true, // hideCompletedItems = true
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      expect(result.current.filteredTodos).toHaveLength(3);
      expect(result.current.filteredTodos.map((t) => t.id)).toEqual([1, 3, 4]);
    });

    it('includes all todos when hideCompletedItems is false', () => {
      const todos = createMockTodos();
      const { result } = renderHook(() =>
        useFilteredTodos(
          todos,
          false, // hideCompletedItems = false
          mockInsertTodoBelow,
          mockRemoveTodoAt,
          mockSetSelectedTodos,
          mockFocusTodo,
        ),
      );

      expect(result.current.filteredTodos).toHaveLength(4);
      expect(result.current.filteredTodos.map((t) => t.id)).toEqual([
        1, 2, 3, 4,
      ]);
    });
  });
});
