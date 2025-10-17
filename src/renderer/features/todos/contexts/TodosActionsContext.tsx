import { createContext, useContext } from 'react';
import type { EditorTodo, TodoList } from '../types';

/**
 * Context value containing todos actions (functions to modify state)
 */
export interface TodosActionsContextValue {
  // List management
  /** Create a new todo list and return its ID */
  addList: () => string;
  /** Delete a todo list by ID */
  deleteList: (id: string) => void;
  /** Duplicate a list and return the new list ID */
  duplicateList: (
    sourceListId: string,
    newListName?: string,
  ) => Promise<string | null>;
  /** Set the currently selected list ID */
  setSelectedListId: (id: string | null) => void;

  // Todo operations
  /** Update a todo's text content */
  updateTodo: (id: number, text: string) => void;
  /** Toggle a todo's completion status */
  toggleTodo: (id: number) => void;
  /** Change a todo's indentation level */
  changeIndent: (id: number, delta: number) => void;
  /** Insert a new todo below the specified index */
  insertTodoBelow: (index: number, text?: string) => number;
  /** Remove a todo at the specified index */
  removeTodoAt: (index: number) => void;
  /** Add a new todo at the end of the list */
  addTodoAtEnd: (text: string) => number;

  // List management
  /** Update a list's properties */
  updateList: (id: string, updates: Partial<TodoList>) => void;

  // Utility functions
  /** Get todos for the currently selected list */
  getSelectedTodos: () => EditorTodo[];
  /** Update todos for the currently selected list */
  setSelectedTodos: (
    updater: (prev: EditorTodo[]) => EditorTodo[] | null | undefined,
  ) => void;
  /** Flush current todos to storage */
  flushCurrentTodos: () => Promise<boolean>;
}

/**
 * React context for todos actions (functions to modify state)
 */
const TodosActionsContext = createContext<TodosActionsContextValue | null>(
  null,
);

/**
 * Hook to access todos actions.
 *
 * This hook provides functions to modify todos state:
 * - List management (add, delete, duplicate, select)
 * - Todo operations (update, toggle, indent, insert, remove)
 * - Utility functions for data access
 *
 * @returns Todos actions context value
 * @throws Error if used outside of TodosProvider
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const { addList, deleteList, updateTodo, toggleTodo } = useTodosActions();
 *
 *   const handleAddList = () => {
 *     const newId = addList();
 *     console.log('Created list:', newId);
 *   };
 *
 *   const handleToggleTodo = (id: number) => {
 *     toggleTodo(id);
 *   };
 *
 *   return 'Todo list component';
 * }
 * ```
 */
export const useTodosActions = (): TodosActionsContextValue => {
  const context = useContext(TodosActionsContext);
  if (!context) {
    throw new Error(
      'useTodosActions must be used within a TodosActionsProvider',
    );
  }
  return context;
};

export default TodosActionsContext;
