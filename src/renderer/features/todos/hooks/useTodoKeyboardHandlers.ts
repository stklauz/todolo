import React from 'react';
import type { EditorTodo } from '../types';

export interface UseTodoKeyboardHandlersProps {
  allTodos: EditorTodo[];
  changeIndent: (id: number, delta: number) => void;
  insertTodoBelow: (index: number, text?: string) => number;
  removeTodoAt: (index: number) => void;
  focusTodo: (id: number) => void;
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
 */
function handleEnterKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  index: number,
  allTodos: EditorTodo[],
  insertTodoBelow: (index: number, text?: string) => number,
  focusTodo: (id: number) => void,
): void {
  event.preventDefault();
  const cur = allTodos[index];
  if (!cur || cur.text.trim().length === 0) {
    return;
  }
  const newId = insertTodoBelow(index, '');
  focusTodo(newId);
}

/**
 * Helper function to handle Backspace key events
 */
function handleBackspaceKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  id: number,
  index: number,
  allTodos: EditorTodo[],
  changeIndent: (id: number, delta: number) => void,
  removeTodoAt: (index: number) => void,
  focusTodo: (id: number) => void,
): void {
  const isEmpty = allTodos[index]?.text.length === 0;
  if (!isEmpty) return;

  event.preventDefault();
  const cur = allTodos[index];
  const ind = Number(cur?.indent ?? 0);

  if (ind > 0) {
    changeIndent(cur.id, -1);
    return;
  }

  if (allTodos.length <= 1) return;

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
            handleEnterKey(event, index, allTodos, insertTodoBelow, focusTodo);
            break;
          case 'Backspace':
            handleBackspaceKey(
              event,
              id,
              index,
              allTodos,
              changeIndent,
              removeTodoAt,
              focusTodo,
            );
            break;
          default:
            // No action for other keys
            break;
        }
      };
    },
    [allTodos, changeIndent, insertTodoBelow, removeTodoAt, focusTodo],
  );
}
