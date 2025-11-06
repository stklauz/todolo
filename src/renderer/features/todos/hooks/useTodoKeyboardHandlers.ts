import React from 'react';
import type { EditorTodo } from '../types';
import { getCursorPosition, isCursorAtStart } from '../utils/cursorUtils';
import type { FocusPosition } from './useTodoFocus';
import { debugLogger } from '../../../utils/debug';

export interface UseTodoKeyboardHandlersProps {
  allTodos: EditorTodo[];
  changeIndent: (id: number, delta: number) => void;
  insertTodoBelow: (index: number, text?: string) => number;
  removeTodoAt: (index: number) => void;
  updateTodo: (id: number, text: string) => void;
  focusTodo: (id: number, position?: FocusPosition) => void;
}

/**
 * Helper function to check if a todo has a parent above it
 */
function hasParentAbove(allTodos: EditorTodo[], currentIndex: number): boolean {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (Number(allTodos[i].indent ?? 0) === 0) return true;
  }
  return false;
}

/**
 * Helper function to handle Tab key events
 */
function handleTabKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  id: number,
  index: number,
  allTodos: EditorTodo[],
  changeIndent: (id: number, delta: number) => void,
): void {
  event.preventDefault();
  if (event.shiftKey) {
    changeIndent(id, -1);
  } else if (hasParentAbove(allTodos, index)) {
    changeIndent(id, +1);
  }
}

/**
 * Helper function to handle Enter key events
 * Supports splitting todo content based on cursor position
 */
function handleEnterKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  index: number,
  allTodos: EditorTodo[],
  updateTodo: (id: number, text: string) => void,
  insertTodoBelow: (index: number, text?: string) => number,
  focusTodo: (id: number, position?: FocusPosition) => void,
): void {
  event.preventDefault();
  const cur = allTodos[index];
  if (!cur || cur.text.trim().length === 0) {
    return;
  }

  const el = event.currentTarget;
  const cursorPos = getCursorPosition(el);
  const text = el.value;

  // Split content at cursor position (preserve whitespace)
  const leftContent = text.slice(0, cursorPos);
  const rightContent = text.slice(cursorPos);

  let branch: 'start' | 'middle' | 'end';
  let newTodoId: number;

  if (cursorPos === 0) {
    // Cursor at start: current todo becomes empty, content moves to new todo
    branch = 'start';
    updateTodo(cur.id, '');
    newTodoId = insertTodoBelow(index, text);
    focusTodo(newTodoId, 'start');
  } else if (cursorPos === text.length) {
    // Cursor at end: create new empty todo (preserve current behavior)
    branch = 'end';
    newTodoId = insertTodoBelow(index, '');
    focusTodo(newTodoId, 'start');
  } else {
    // Cursor in middle: split content
    branch = 'middle';
    updateTodo(cur.id, leftContent);
    newTodoId = insertTodoBelow(index, rightContent);
    focusTodo(newTodoId, 'start');
  }

  // Debug logging for observability
  debugLogger.log('info', 'Enter key: split todo', {
    branch,
    todoId: cur.id,
    cursorPos,
    newTodoId,
    leftContent: leftContent.slice(0, 50), // Truncate for logs
    rightContent: rightContent.slice(0, 50),
  });
}

/**
 * Helper function to handle Backspace key events
 * Supports merging todos when cursor is at start (reverse of split)
 */
function handleBackspaceKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  id: number,
  index: number,
  allTodos: EditorTodo[],
  changeIndent: (id: number, delta: number) => void,
  removeTodoAt: (index: number) => void,
  updateTodo: (id: number, text: string) => void,
  focusTodo: (id: number, position?: FocusPosition) => void,
): void {
  const el = event.currentTarget;
  const cur = allTodos[index];
  if (!cur) return;

  // If text is selected, don't intercept - let browser handle selection deletion
  const hasSelection = el.selectionStart !== el.selectionEnd;
  if (hasSelection) {
    return;
  }

  const cursorAtStart = isCursorAtStart(el);
  const isEmpty = cur.text.length === 0;

  // If cursor is at start AND todo has content: merge with previous todo
  if (cursorAtStart && !isEmpty) {
    // Can't merge if this is the first todo
    if (index === 0) {
      // Do nothing - let browser handle normal text editing
      return;
    }

    const prevTodo = allTodos[index - 1];
    if (!prevTodo) {
      // No previous todo - shouldn't happen if index > 0, but guard anyway
      return;
    }

    event.preventDefault();

    // Merge current todo content with previous todo
    const mergedText = prevTodo.text + cur.text;
    updateTodo(prevTodo.id, mergedText);
    removeTodoAt(index);

    // Focus previous todo at the junction point (where merge happened)
    // Position cursor at the end of the previous todo's original content
    const junctionPosition = prevTodo.text.length;
    focusTodo(prevTodo.id, junctionPosition);

    // Debug logging for observability
    debugLogger.log('info', 'Backspace key: merge todo', {
      currentTodoId: cur.id,
      previousTodoId: prevTodo.id,
      mergedContent: mergedText.slice(0, 50), // Truncate for logs
      cursorPos: 0,
    });

    return;
  }

  // If cursor is in middle/end of text: don't intercept (normal text editing)
  if (!cursorAtStart) {
    return;
  }

  // Remaining logic: cursor at start AND todo is empty (existing behavior)
  event.preventDefault();
  const ind = Number(cur?.indent ?? 0);

  if (ind > 0) {
    changeIndent(cur.id, -1);
    return;
  }

  if (allTodos.length <= 1) return;

  // If deleting a parent (top-level item), compute correct focus target:
  // - If it has children and we can find a new parent, focus that new parent
  // - Otherwise, focus the previous item
  if (cur.parentId == null) {
    // Check if this parent has children
    const hasChildren = allTodos.some((t) => t.parentId === cur.id);
    if (hasChildren) {
      // Find nearest previous ACTIVE parent candidate (same logic as removeTodoAt)
      let newParentId: number | null = null;
      for (let i = index - 1; i >= 0; i--) {
        const cand = allTodos[i];
        if (cand && cand.parentId == null && !cand.completed) {
          newParentId = cand.id;
          break;
        }
      }
      if (newParentId != null) {
        removeTodoAt(index);
        focusTodo(newParentId);
        return;
      }
    }
  }

  // Default: remove and focus previous item
  removeTodoAt(index);
  const prevTodo = allTodos[index - 1];
  if (prevTodo) {
    focusTodo(prevTodo.id);
  }
}

/**
 * Custom hook for handling keyboard interactions on todo items.
 *
 * Provides a handler factory that creates keyboard event handlers for individual todos.
 * Handles Tab (indent/outdent), Enter (create new todo), and Backspace (delete/outdent) keys.
 *
 * @param props - Configuration object containing todos and action functions
 * @returns A function that creates keyboard handlers for specific todo IDs
 *
 * @example
 * ```tsx
 * const handleTodoKeyDown = useTodoKeyboardHandlers({
 *   allTodos,
 *   changeIndent,
 *   insertTodoBelow,
 *   removeTodoAt,
 *   focusTodo
 * });
 *
 * // Use in JSX
 * <textarea onKeyDown={handleTodoKeyDown(todo.id)} />
 * ```
 */
export default function useTodoKeyboardHandlers({
  allTodos,
  changeIndent,
  insertTodoBelow,
  removeTodoAt,
  updateTodo,
  focusTodo,
}: UseTodoKeyboardHandlersProps) {
  return React.useCallback(
    (id: number) => {
      return (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const index = allTodos.findIndex((t) => t.id === id);
        if (index === -1) return;

        switch (event.key) {
          case 'Tab':
            handleTabKey(event, id, index, allTodos, changeIndent);
            break;
          case 'Enter':
            handleEnterKey(
              event,
              index,
              allTodos,
              updateTodo,
              insertTodoBelow,
              focusTodo,
            );
            break;
          case 'Backspace':
            handleBackspaceKey(
              event,
              id,
              index,
              allTodos,
              changeIndent,
              removeTodoAt,
              updateTodo,
              focusTodo,
            );
            break;
          default:
            // No action for other keys
            break;
        }
      };
    },
    [
      allTodos,
      changeIndent,
      insertTodoBelow,
      removeTodoAt,
      updateTodo,
      focusTodo,
    ],
  );
}
