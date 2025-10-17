import React from 'react';
import type { EditorTodo } from '../types';

/**
 * Return type for the useTodoFocus hook
 */
export interface UseTodoFocusReturn {
  /** Map of todo IDs to their corresponding input elements */
  inputByIdRef: React.MutableRefObject<Map<number, HTMLTextAreaElement>>;
  /** Ref to track which todo should be focused next */
  focusNextIdRef: React.MutableRefObject<number | null>;
  /** Function to register/unregister input elements */
  setInputRef: (id: number, el: HTMLTextAreaElement | null) => void;
  /** Function to schedule a todo for focus */
  focusTodo: (id: number) => void;
  /** Function to clear any pending focus */
  clearFocus: () => void;
}

/**
 * Custom hook for managing focus on todo input elements.
 *
 * This hook provides utilities to:
 * - Track input elements by todo ID
 * - Schedule focus on specific todos
 * - Manage focus state across todo operations
 *
 * @returns Object containing focus management utilities
 *
 * @example
 * ```tsx
 * const { inputByIdRef, focusNextIdRef, setInputRef, focusTodo } = useTodoFocus();
 *
 * // Schedule focus on a todo
 * focusTodo(todoId);
 *
 * // Register an input element
 * const textareaRef = (el) => setInputRef(todoId, el);
 * ```
 */
export default function useTodoFocus(): UseTodoFocusReturn {
  // Track inputs by todo id so we can focus newly inserted rows
  const inputByIdRef = React.useRef(new Map<number, HTMLTextAreaElement>());
  const focusNextIdRef = React.useRef<number | null>(null);

  // Keep the map in sync as inputs mount/unmount
  const setInputRef = React.useCallback(
    (id: number, el: HTMLTextAreaElement | null) => {
      if (el) {
        inputByIdRef.current.set(id, el);
      } else {
        inputByIdRef.current.delete(id);
      }
    },
    [],
  );

  const focusTodo = React.useCallback((id: number) => {
    focusNextIdRef.current = id;
  }, []);

  const clearFocus = React.useCallback(() => {
    focusNextIdRef.current = null;
  }, []);

  return {
    inputByIdRef,
    focusNextIdRef,
    setInputRef,
    focusTodo,
    clearFocus,
  };
}

/**
 * Effect hook to handle automatic focus management for todos.
 *
 * This hook automatically focuses todos based on:
 * - Scheduled focus requests (via focusNextIdRef)
 * - Single todo scenarios (auto-focus the only todo)
 *
 * It respects editing state to avoid interfering with title editing.
 *
 * @param todos - Array of current todos
 * @param focusNextIdRef - Ref containing the ID of the todo to focus
 * @param inputByIdRef - Map of todo IDs to their input elements
 * @param isEditingRef - Optional ref indicating if title editing is active
 *
 * @example
 * ```tsx
 * useTodoFocusEffect(todos, focusNextIdRef, inputByIdRef, isEditingRef);
 * ```
 */
export function useTodoFocusEffect(
  todos: EditorTodo[],
  focusNextIdRef: React.MutableRefObject<number | null>,
  inputByIdRef: React.MutableRefObject<Map<number, HTMLTextAreaElement>>,
  isEditingRef?: React.MutableRefObject<boolean>,
) {
  React.useEffect(() => {
    // Don't interfere with title editing
    if (isEditingRef?.current) return;

    const id = focusNextIdRef.current;
    if (id != null) {
      const el = inputByIdRef.current.get(id);
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        focusNextIdRef.current = null;
      }
    } else if (todos.length === 1) {
      const only = todos[0];
      const el = inputByIdRef.current.get(only.id);
      if (el) {
        el.focus();
      }
    }
  }, [todos, focusNextIdRef, inputByIdRef, isEditingRef]);
}
