import React from 'react';
import { loadAppSettings, saveAppSettings } from '../api/storage';
import useTodosState from '../hooks/useTodosState';
import TodosContext, { useTodosContext } from './TodosContext';
import TodosActionsContext, { useTodosActions } from './TodosActionsContext';
import type { AppSettings } from '../types';

/**
 * Props for the TodosProvider component
 */
interface TodosProviderProps {
  /** Child components that will have access to the todos context */
  children: React.ReactNode;
}

/**
 * Provider component that wraps the application with todos state and actions context.
 *
 * This provider:
 * - Manages global todos state using useTodosState
 * - Provides app settings management (hide completed items)
 * - Exposes todos data via TodosContext
 * - Exposes todos actions via TodosActionsContext
 * - Handles app settings persistence
 *
 * @param props - Component props
 * @returns JSX element providing todos context to children
 *
 * @example
 * ```tsx
 * function App() {
 *   return 'App with TodosProvider wrapper';
 * }
 *
 * // In child components:
 * function TodoList() {
 *   const { lists, selectedListId } = useTodosContext();
 *   const { addList, deleteList } = useTodosActions();
 *   return 'Todo list component';
 * }
 * ```
 */
function TodosProvider({ children }: TodosProviderProps) {
  const {
    lists,
    // setLists,
    selectedListId,
    setSelectedListId,
    getSelectedTodos,
    setSelectedTodos,
    updateTodo,
    toggleTodo,
    changeIndent,
    insertTodoBelow,
    removeTodoAt,
    addTodoAtEnd,
    addList,
    deleteList,
    duplicateList,
    flushCurrentTodos,
  } = useTodosState();

  // App settings state
  const [appSettings, setAppSettings] = React.useState<AppSettings>({
    hideCompletedItems: true,
  });

  // Load app settings on mount
  React.useEffect(() => {
    loadAppSettings().then(setAppSettings);
  }, []);

  // Function to update app settings
  const updateAppSettings = React.useCallback(
    async (newSettings: AppSettings) => {
      setAppSettings(newSettings);
      await saveAppSettings(newSettings);
    },
    [],
  );

  const todosContextValue = React.useMemo(
    () => ({
      lists,
      selectedListId,
      appSettings,
    }),
    [lists, selectedListId, appSettings],
  );

  const todosActionsValue = React.useMemo(
    () => ({
      addList,
      deleteList,
      duplicateList,
      setSelectedListId,
      updateTodo,
      toggleTodo,
      changeIndent,
      insertTodoBelow,
      removeTodoAt,
      addTodoAtEnd,
      updateAppSettings,
      getSelectedTodos,
      setSelectedTodos,
      flushCurrentTodos,
    }),
    [
      addList,
      deleteList,
      duplicateList,
      setSelectedListId,
      updateTodo,
      toggleTodo,
      changeIndent,
      insertTodoBelow,
      removeTodoAt,
      addTodoAtEnd,
      updateAppSettings,
      getSelectedTodos,
      setSelectedTodos,
      flushCurrentTodos,
    ],
  );

  return (
    <TodosContext.Provider value={todosContextValue}>
      <TodosActionsContext.Provider value={todosActionsValue}>
        {children}
      </TodosActionsContext.Provider>
    </TodosContext.Provider>
  );
}

// Export hooks for convenience
export { useTodosContext, useTodosActions };
export default TodosProvider;
