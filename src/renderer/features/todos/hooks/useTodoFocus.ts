import React from 'react';
import type { EditorTodo } from '../types';

/**
 * Focus position for cursor placement
 * - 'start': Cursor at position 0
 * - 'end': Cursor at end of text
 * - number: Cursor at specific character position
 */
export type FocusPosition = 'start' | 'end' | number;

/**
 * Focus request with position information
 */
export interface FocusRequest {
  id: number;
  position: FocusPosition;
}

/**
 * Return type for the useTodoFocus hook
 */
export interface UseTodoFocusReturn {
  /** Map of todo IDs to their corresponding input elements */
  inputByIdRef: React.MutableRefObject<Map<number, HTMLTextAreaElement>>;
  /** Ref to track which todo should be focused next */
  focusNextIdRef: React.MutableRefObject<FocusRequest | null>;
  /** Function to register/unregister input elements */
  setInputRef: (id: number, el: HTMLTextAreaElement | null) => void;
  /** Function to schedule a todo for focus */
  focusTodo: (id: number, position?: FocusPosition) => void;
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
  const focusNextIdRef = React.useRef<FocusRequest | null>(null);

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

  const focusTodo = React.useCallback(
    (id: number, position: FocusPosition = 'end') => {
      focusNextIdRef.current = { id, position };
    },
    [],
  );

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
  focusNextIdRef: React.MutableRefObject<FocusRequest | null>,
  inputByIdRef: React.MutableRefObject<Map<number, HTMLTextAreaElement>>,
  isEditingRef?: React.MutableRefObject<boolean>,
) {
  React.useEffect(() => {
    // Don't interfere with title editing
    if (isEditingRef?.current) return;

    const focusRequest = focusNextIdRef.current;
    if (focusRequest != null) {
      const el = inputByIdRef.current.get(focusRequest.id);
      if (el) {
        el.focus();
        let cursorPos: number;
        if (focusRequest.position === 'start') {
          cursorPos = 0;
        } else if (focusRequest.position === 'end') {
          cursorPos = el.value.length;
        } else {
          // Number position - clamp to valid range
          cursorPos = Math.max(
            0,
            Math.min(focusRequest.position, el.value.length),
          );
        }
        el.setSelectionRange(cursorPos, cursorPos);
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
