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
  /** Function to insert a todo below a filtered index and focus it */
  insertBelowAndFocus: (index: number, text?: string) => void;
  /** Function to remove a todo at a filtered index and manage focus */
  removeAtAndManageFocus: (index: number) => void;
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

  const insertBelowAndFocus = React.useCallback(
    (index: number, text = '') => {
      // If we're filtering completed items, we need to find the correct position in the full list
      if (hideCompletedItems) {
        // Find the target todo in the visible list
        const target = filteredTodos[index];
        if (!target) return;

        // Find its position in the full list
        const fullIndex = allTodos.findIndex((t) => t.id === target.id);
        if (fullIndex < 0) return;

        // Insert after the found position in the full list
        const id = insertTodoBelow(fullIndex, text);
        focusTodo(id);
      } else {
        // No filtering, use index directly
        const id = insertTodoBelow(index, text);
        focusTodo(id);
      }
    },
    [hideCompletedItems, filteredTodos, allTodos, insertTodoBelow, focusTodo],
  );

  const removeAtAndManageFocus = React.useCallback(
    (index: number) => {
      if (hideCompletedItems) {
        // Translate filtered index -> id -> full list index
        const target = filteredTodos[index];
        if (!target) return;
        const targetId = target.id;
        setSelectedTodos((prev) => {
          const fullIdx = prev.findIndex((t) => t.id === targetId);
          if (fullIdx === -1) return prev;
          const next = [...prev];
          next.splice(fullIdx, 1);
          if (next.length === 0) {
            // No focus needed if no todos left
          } else {
            const focusIdx = Math.max(0, fullIdx - 1);
            const focusTarget = next[focusIdx] ?? next[0];
            if (focusTarget) focusTodo(focusTarget.id);
          }
          return next;
        });
      } else {
        // No filtering, use index directly
        setSelectedTodos((prev) => {
          const next = [...prev];
          next.splice(index, 1);
          if (next.length === 0) {
            // No focus needed if no todos left
          } else {
            const target = next[Math.max(0, index - 1)] ?? next[0];
            if (target) focusTodo(target.id);
          }
          return next;
        });
      }
    },
    [hideCompletedItems, filteredTodos, setSelectedTodos, focusTodo],
  );

  return {
    filteredTodos,
    allTodos,
    insertBelowAndFocus,
    removeAtAndManageFocus,
  };
}
