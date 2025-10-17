import React from 'react';
import type { EditorTodo } from '../types';

/**
 * Return type for the useFilteredTodos hook
 */
export interface UseFilteredTodosReturn {
  /** Array of todos after applying filters */
  filteredTodos: EditorTodo[];
  /** Original unfiltered array of todos */
  allTodos: EditorTodo[];
  /** Function to insert a todo below a specified todo and focus it */
  insertBelowAndFocus: (todoId: number, text?: string) => void;
  /** Function to remove a todo by ID and manage focus */
  removeAtAndManageFocus: (todoId: number) => void;
}

/**
 * Custom hook for managing filtered todos with proper index translation.
 *
 * This hook handles the complexity of working with filtered todo lists by:
 * - Providing filtered todos based on completion status
 * - Translating filtered indices to actual list indices for operations
 * - Managing focus after insert/remove operations
 * - Handling edge cases when filtering is active
 *
 * @param allTodos - Complete array of todos
 * @param hideCompletedItems - Whether to filter out completed todos
 * @param insertTodoBelow - Function to insert a todo below a given index
 * @param removeTodoAt - Function to remove a todo at a given index
 * @param setSelectedTodos - Function to update the selected todos
 * @param focusTodo - Function to focus a todo by ID
 * @returns Object containing filtered todos and operation functions
 *
 * @example
 * ```tsx
 * const {
 *   filteredTodos,
 *   insertBelowAndFocus,
 *   removeAtAndManageFocus
 * } = useFilteredTodos(
 *   allTodos,
 *   hideCompletedItems,
 *   insertTodoBelow,
 *   removeTodoAt,
 *   setSelectedTodos,
 *   focusTodo
 * );
 *
 * // Insert below visible todo (handles index translation)
 * insertBelowAndFocus(visibleIndex, 'New todo');
 *
 * // Remove visible todo (handles index translation and focus)
 * removeAtAndManageFocus(visibleIndex);
 * ```
 */
export default function useFilteredTodos(
  allTodos: EditorTodo[],
  hideCompletedItems: boolean,
  insertTodoBelow: (index: number, text?: string) => number,
  removeTodoAt: (index: number) => void,
  setSelectedTodos: (
    updater: (prev: EditorTodo[]) => EditorTodo[] | null | undefined,
  ) => void,
  focusTodo: (id: number) => void,
): UseFilteredTodosReturn {
  const filteredTodos = React.useMemo(() => {
    return hideCompletedItems
      ? allTodos.filter((todo) => !todo.completed)
      : allTodos;
  }, [allTodos, hideCompletedItems]);

  /**
   * Insert a new todo below the specified todo and focus it.
   *
   * @param todoId - ID of the todo to insert below (uses ID instead of index to avoid
   *                 ambiguity between filtered and full list positions)
   * @param text - Optional text for the new todo
   */
  const insertBelowAndFocus = React.useCallback(
    (todoId: number, text = '') => {
      // Find the todo in the full list by ID
      const fullIndex = allTodos.findIndex((t) => t.id === todoId);
      if (fullIndex < 0) return;

      // Always insert based on full list position
      const id = insertTodoBelow(fullIndex, text);
      focusTodo(id);
    },
    [allTodos, insertTodoBelow, focusTodo],
  );

  /**
   * Remove a todo and manage focus appropriately.
   *
   * @param todoId - ID of the todo to remove (uses ID instead of index to avoid
   *                 ambiguity between filtered and full list positions)
   */
  const removeAtAndManageFocus = React.useCallback(
    (todoId: number) => {
      setSelectedTodos((prev) => {
        const fullIdx = prev.findIndex((t) => t.id === todoId);
        if (fullIdx === -1) return prev;

        const next = [...prev];
        next.splice(fullIdx, 1);

        if (next.length > 0) {
          const focusIdx = Math.max(0, fullIdx - 1);
          const focusTarget = next[focusIdx] ?? next[0];
          if (focusTarget) focusTodo(focusTarget.id);
        }

        return next;
      });
    },
    [setSelectedTodos, focusTodo],
  );

  return {
    filteredTodos,
    allTodos,
    insertBelowAndFocus,
    removeAtAndManageFocus,
  };
}
