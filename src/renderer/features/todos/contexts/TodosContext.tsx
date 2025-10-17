import { createContext, useContext } from 'react';
import type { TodoList, AppSettings } from '../types';

/**
 * Context value containing todos data (read-only state)
 */
export interface TodosContextValue {
  /** Array of all todo lists */
  lists: TodoList[];
  /** ID of the currently selected list */
  selectedListId: string | null;
  /** Application settings */
  appSettings: AppSettings;
}

/**
 * React context for todos data (read-only state)
 */
const TodosContext = createContext<TodosContextValue | null>(null);

/**
 * Hook to access todos context data.
 *
 * This hook provides read-only access to:
 * - All todo lists
 * - Currently selected list ID
 * - Application settings
 *
 * @returns Todos context value
 * @throws Error if used outside of TodosProvider
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const { lists, selectedListId, appSettings } = useTodosContext();
 *
 *   const selectedList = lists.find(l => l.id === selectedListId);
 *   const hideCompleted = appSettings.hideCompletedItems;
 *
 *   return selectedList ? selectedList.name : 'No list selected';
 * }
 * ```
 */
export const useTodosContext = (): TodosContextValue => {
  const context = useContext(TodosContext);
  if (!context) {
    throw new Error('useTodosContext must be used within a TodosProvider');
  }
  return context;
};

export default TodosContext;
