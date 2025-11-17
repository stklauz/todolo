import React from 'react';
import type { EditorTodo, TodoList } from '../types';
import useListsIndex from './useListsIndex';
import useListsManagement from './useListsManagement';
import useTodosOperations from './useTodosOperations';
import useTodosPersistence from './useTodosPersistence';
import { useTodosStore } from '../store/useTodosStore';

/**
 * Phase 5 Refactor: Simplified state hook.
 * Before: Managed all state locally with refs (14+ parameters passed to child hooks)
 * After: Store manages state, hooks take zero parameters
 */
export default function useTodosState() {
  // Read from store (no local state!)
  const lists = useTodosStore((state) => state.lists);
  const selectedListId = useTodosStore((state) => state.selectedListId);
  const setLists = useTodosStore((state) => state.setLists);
  const setSelectedListId = useTodosStore((state) => state.setSelectedListId);
  const nextId = useTodosStore((state) => state.nextId);

  // Computed getters
  const getSelectedTodos = React.useCallback((): EditorTodo[] => {
    const list = lists.find((l) => l.id === selectedListId);
    return list ? list.todos : [];
  }, [lists, selectedListId]);

  const setSelectedTodos = React.useCallback(
    (updater: (prev: EditorTodo[]) => EditorTodo[] | null | undefined) => {
      setLists((prevLists) => {
        const targetId = useTodosStore.getState().selectedListId;
        const next = prevLists.map((l) => {
          if (l.id !== targetId) return l;
          const updated = updater(l.todos);
          if (!updated) return l;
          // Only create new object if todos actually changed
          if (updated === l.todos) return l;
          return { ...l, todos: updated, updatedAt: new Date().toISOString() };
        });
        // Only update state if something actually changed
        const hasChanges = next.some((l, i) => l !== prevLists[i]);
        return hasChanges ? next : prevLists;
      });
    },
    [setLists],
  );

  // Initialize hooks (no parameters!)
  useListsIndex();
  const { saveWithStrategy, flushCurrentTodos } = useTodosPersistence();

  // Lists management still needs some props (will refactor next)
  const {
    addList,
    deleteSelectedList,
    deleteList,
    duplicateList,
    setSelectedListIdWithSave,
  } = useListsManagement({
    lists,
    setLists,
    selectedListId,
    setSelectedListId,
    listsRef: { current: lists }, // Temp for compatibility
    loadedListsRef: { current: useTodosStore.getState().loadedLists },
    saveWithStrategy,
    flushCurrentTodos,
  });

  // Todos operations still needs some props (will refactor next)
  const {
    updateTodo,
    toggleTodo,
    setIndent,
    changeIndent,
    insertTodoBelow,
    removeTodoAt,
  } = useTodosOperations({
    setSelectedTodos,
    saveWithStrategy,
    nextId,
  });

  const updateList = React.useCallback(
    (id: string, updates: Partial<TodoList>) => {
      // Delegate to store action for consistency
      useTodosStore.getState().updateListMeta(id, {
        name: updates.name ?? undefined,
      });
    },
    [],
  );

  /**
   * Central state management for todos and lists.
   * Phase 5: Now powered by Zustand store (no local state/refs!)
   */
  return {
    lists,
    setLists,
    selectedListId,
    setSelectedListId: setSelectedListIdWithSave,
    getSelectedTodos,
    setSelectedTodos,
    updateTodo,
    toggleTodo,
    setIndent,
    changeIndent,
    insertTodoBelow,
    removeTodoAt,
    addList,
    deleteSelectedList,
    deleteList,
    duplicateList,
    updateList,
    flushCurrentTodos,
  } as const;
}
