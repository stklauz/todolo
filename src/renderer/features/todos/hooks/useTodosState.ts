import React from 'react';
import type { EditorTodo, TodoList } from '../types';
import useListsIndex from './useListsIndex';
import useListsManagement from './useListsManagement';
import useTodosOperations from './useTodosOperations';
import useTodosPersistence from './useTodosPersistence';

export default function useTodosState() {
  const [lists, setLists] = React.useState<TodoList[]>([]);
  const [selectedListId, setSelectedListId] = React.useState<string | null>(
    null,
  );
  const idCounterRef = React.useRef(1);
  const selectedListIdRef = React.useRef<string | null>(null);
  const listsRef = React.useRef<TodoList[]>([]);
  const loadedListsRef = React.useRef<Set<string>>(new Set());

  selectedListIdRef.current = selectedListId;
  React.useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  // ID counter management
  const nextId = () => {
    const id = idCounterRef.current;
    idCounterRef.current += 1;
    return id;
  };

  /**
   * Synchronizes the ID counter with the maximum ID found in loaded todos.
   * Call this after loading todos from storage to ensure new todos get unique IDs.
   * @param maxId - The highest ID currently in use
   */
  const syncIdCounter = (maxId: number) => {
    if (maxId >= idCounterRef.current) {
      idCounterRef.current = maxId + 1;
    }
  };

  const getSelectedTodos = React.useCallback((): EditorTodo[] => {
    const list = lists.find((l) => l.id === selectedListId);
    return list ? list.todos : [];
  }, [lists, selectedListId]);

  const setSelectedTodos = React.useCallback(
    (updater: (prev: EditorTodo[]) => EditorTodo[] | null | undefined) => {
      setLists((prevLists) => {
        const targetId = selectedListIdRef.current;
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
    [],
  );

  // Use the lists index hook
  const { indexLoaded: _indexLoaded } = useListsIndex({
    lists,
    setLists,
    selectedListId,
    setSelectedListId,
    listsRef,
    selectedListIdRef,
  });

  // Use the todos persistence hook
  const { saveWithStrategy, flushCurrentTodos } = useTodosPersistence({
    lists,
    selectedListId,
    selectedListIdRef,
    listsRef,
    loadedListsRef,
    nextId,
    syncIdCounter,
    setLists,
  });

  // Use the lists management hook
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
    listsRef,
    loadedListsRef,
    saveWithStrategy,
    flushCurrentTodos,
  });

  // Use the todos operations hook
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
      setLists((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, ...updates, updatedAt: new Date().toISOString() }
            : l,
        ),
      );
    },
    [],
  );

  /**
   * Central state management for todos and lists.
   *
   * ID Counter Management:
   * - nextId(): Gets next available ID and increments counter
   * - Counter auto-syncs when loading existing lists
   * - Always generates unique IDs within the application lifetime
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
