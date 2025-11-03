import React from 'react';
import { saveListTodos, loadListTodos } from '../api/storage';
import { debugLogger } from '../../../utils/debug';
import { SaveQueue } from '../utils/saveQueue';
import { useTodosStore } from '../store/useTodosStore';

/**
 * Phase 5 Refactor: Zero parameters! Store handles all state.
 * Before: 8 parameters (lists, selectedListId, selectedListIdRef, listsRef, loadedListsRef, nextId, syncIdCounter, setLists)
 * After: 0 parameters
 */
export default function useTodosPersistence() {
  // Read from store (no props!)
  const lists = useTodosStore((state) => state.lists);
  const selectedListId = useTodosStore((state) => state.selectedListId);
  const setLists = useTodosStore((state) => state.setLists);
  const isListLoaded = useTodosStore((state) => state.isListLoaded);
  const markListAsLoaded = useTodosStore((state) => state.markListAsLoaded);
  const nextId = useTodosStore((state) => state.nextId);
  const syncIdCounter = useTodosStore((state) => state.syncIdCounter);

  // No local timers; all save timing is centralized in SaveQueue
  // Queue uses store getState() to always read latest state on save (no refs!)
  const queueRef = React.useRef<SaveQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new SaveQueue(async () => {
      const state = useTodosStore.getState();
      const listId = state.selectedListId;
      if (!listId) return;
      if (!state.isListLoaded(listId)) return;
      const snapshot = state.lists.find((l) => l.id === listId);
      if (!snapshot) return;
      try {
        await saveListTodos(listId, { version: 2, todos: snapshot.todos });
      } catch (error) {
        debugLogger.log('error', 'Queue-triggered save failed', {
          listId,
          error,
        });
      }
    });
  }

  // Smart save function with different strategies
  const saveWithStrategy = React.useCallback(
    (type: 'immediate' | 'debounced', delay = 200) => {
      if (!selectedListId) return;
      // Gate: don't save until this list's todos have been loaded at least once
      if (!isListLoaded(selectedListId)) return;

      const selected = lists.find((l) => l.id === selectedListId);
      if (!selected) return;

      debugLogger.log('info', `Saving todos with ${type} strategy`, {
        listId: selectedListId,
        todoCount: selected.todos.length,
        delay: type === 'debounced' ? delay : 0,
      });

      // All saves go through centralized queue (immediate or debounced)
      // Queue's onSave closure uses store.getState() to always read current state
      queueRef.current?.enqueue(type, delay);
    },
    [lists, selectedListId, isListLoaded],
  );

  // Deterministic flush of current list todos: cancels debounce and awaits save
  const flushCurrentTodos = React.useCallback(async (): Promise<boolean> => {
    const state = useTodosStore.getState();
    const listId = state.selectedListId;
    if (!listId) return false;
    if (!state.isListLoaded(listId)) return false;
    const snapshot = state.lists.find((l) => l.id === listId);
    if (!snapshot) return false;

    // Cancel any pending debounced save
    queueRef.current?.cancel();

    try {
      debugLogger.log('info', 'Flushing todos (awaiting save)', {
        listId,
        todoCount: snapshot.todos.length,
      });
      const ok = await saveListTodos(listId, {
        version: 2,
        todos: snapshot.todos,
      });
      return ok;
    } catch (error) {
      debugLogger.log('error', 'Failed to flush todos', { listId, error });
      return false;
    }
  }, []);

  // Lazy-load selected list todos when selection changes (with caching)
  React.useEffect(() => {
    const run = async () => {
      if (!selectedListId) return;
      const current = lists.find((l) => l.id === selectedListId);
      if (!current) return;

      debugLogger.log(
        'info',
        'List selection changed - checking if todos need loading',
        {
          selectedListId,
          isCached: isListLoaded(selectedListId),
          hasTodos: current.todos && current.todos.length > 0,
        },
      );

      // Skip loading if list is already cached and has todos
      if (
        isListLoaded(selectedListId) &&
        current.todos &&
        current.todos.length > 0
      ) {
        debugLogger.log('info', 'List todos already cached, skipping load');
        return;
      }

      // Skip loading if list already has todos (from previous load)
      if (current.todos && current.todos.length > 0) {
        markListAsLoaded(selectedListId);
        debugLogger.log('info', 'List already has todos, marking as cached');
        return;
      }

      debugLogger.log('info', 'Loading todos for selected list', {
        selectedListId,
      });

      let fetched;
      try {
        fetched = await loadListTodos(selectedListId);
      } catch (error) {
        debugLogger.log('error', 'Failed to load todos from storage', {
          selectedListId,
          error,
        });
        // Seed with empty todo on load failure
        fetched = { version: 2, todos: [] };
      }

      const todosNorm = (fetched.todos || []).map((t: any, i: number) => {
        const todo: any = {
          id: typeof t.id === 'number' ? t.id : i + 1,
          text: typeof t.text === 'string' ? t.text : String(t.text ?? ''),
          completed: Boolean(
            (t as any).completed ?? (t as any).checked ?? false,
          ),
          indent: Math.max(0, Math.min(1, Number((t as any).indent ?? 0))),
        };
        // Preserve parentId from database (section is computed, not persisted)
        if (t.parentId !== undefined) {
          todo.parentId = t.parentId;
        }
        return todo;
      });

      if (todosNorm.length === 0) {
        const firstId = nextId();
        const seed = [
          {
            id: firstId,
            text: '',
            completed: false,
            indent: 0,
            parentId: null,
          },
        ];
        setLists((prev) =>
          prev.map((l) =>
            l.id === selectedListId ? { ...l, todos: seed } : l,
          ),
        );
        markListAsLoaded(selectedListId);
        saveListTodos(selectedListId, { version: 2, todos: seed }).catch(
          (error) => {
            debugLogger.log('error', 'Failed to save seed todos', error);
          },
        );
        debugLogger.log('info', 'Created new empty list with seed todo', {
          selectedListId,
        });
      } else {
        setLists((prev) =>
          prev.map((l) =>
            l.id === selectedListId ? { ...l, todos: todosNorm } : l,
          ),
        );
        markListAsLoaded(selectedListId);
        const maxId = todosNorm.reduce((m, t) => (t.id > m ? t.id : m), 0);
        syncIdCounter(maxId);
        debugLogger.log('info', 'Loaded existing todos for list', {
          selectedListId,
          todoCount: todosNorm.length,
          maxId,
          nextIdWillBe: maxId + 1,
        });
      }
    };
    void run();
  }, [
    selectedListId,
    lists,
    isListLoaded,
    markListAsLoaded,
    setLists,
    nextId,
    syncIdCounter,
  ]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      queueRef.current?.cancel();
    };
  }, []);

  // Ensure pending debounced saves flush on app/window close or hide
  React.useEffect(() => {
    const flushSaves = () => {
      // Force an immediate save of current list's todos
      queueRef.current?.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushSaves();
    };
    window.addEventListener('beforeunload', flushSaves);
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', flushSaves);
    return () => {
      window.removeEventListener('beforeunload', flushSaves);
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', flushSaves);
    };
  }, []); // No deps needed - queueRef is stable, handlers don't depend on external state

  return {
    saveWithStrategy,
    flushCurrentTodos,
  } as const;
}
