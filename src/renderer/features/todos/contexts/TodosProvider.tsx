import React from 'react';
import useTodosState from '../hooks/useTodosState';
import TodosContext, { useTodosContext } from './TodosContext';
import TodosActionsContext, { useTodosActions } from './TodosActionsContext';

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
 * - Exposes todos data via TodosContext
 * - Exposes todos actions via TodosActionsContext
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
    updateList,
    flushCurrentTodos,
  } = useTodosState();

  const todosContextValue = React.useMemo(
    () => ({
      lists,
      selectedListId,
    }),
    [lists, selectedListId],
  );

  const todosActionsValue = React.useMemo(
    () => ({
      addList,
      deleteList,
      duplicateList,
      updateList,
      setSelectedListId,
      updateTodo,
      toggleTodo,
      changeIndent,
      insertTodoBelow,
      removeTodoAt,
      addTodoAtEnd,
      getSelectedTodos,
      setSelectedTodos,
      flushCurrentTodos,
    }),
    [
      addList,
      deleteList,
      duplicateList,
      updateList,
      setSelectedListId,
      updateTodo,
      toggleTodo,
      changeIndent,
      insertTodoBelow,
      removeTodoAt,
      addTodoAtEnd,
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
