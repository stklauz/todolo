import React from 'react';
import { saveListTodos, loadListTodos } from '../api/storage';
import type { TodoList } from '../types';
import { debugLogger } from '../../../utils/debug';

type UseTodosPersistenceProps = {
  lists: TodoList[];
  selectedListId: string | null;
  selectedListIdRef: React.MutableRefObject<string | null>;
  listsRef: React.MutableRefObject<TodoList[]>;
  loadedListsRef: React.MutableRefObject<Set<string>>;
  nextId: () => number;
  syncIdCounter: (maxId: number) => void;
  setLists: React.Dispatch<React.SetStateAction<TodoList[]>>;
};

export default function useTodosPersistence({
  lists,
  selectedListId,
  selectedListIdRef,
  listsRef,
  loadedListsRef,
  nextId,
  syncIdCounter,
  setLists,
}: UseTodosPersistenceProps) {
  const todosSaveTimerRef = React.useRef<number | null>(null);

  // Smart save function with different strategies
  const saveWithStrategy = React.useCallback(
    (type: 'immediate' | 'debounced', delay = 200) => {
      if (!selectedListId) return;
      // Gate: don't save until this list's todos have been loaded at least once
      if (!loadedListsRef.current.has(selectedListId)) return;

      const selected = lists.find((l) => l.id === selectedListId);
      if (!selected) return;

      const doc = { version: 2, todos: selected.todos } as const;

      debugLogger.log('info', `Saving todos with ${type} strategy`, {
        listId: selectedListId,
        todoCount: selected.todos.length,
        delay: type === 'debounced' ? delay : 0,
      });

      if (type === 'immediate') {
        // Clear any pending debounced saves
        if (todosSaveTimerRef.current) {
          window.clearTimeout(todosSaveTimerRef.current);
          todosSaveTimerRef.current = null;
        }
        // Save immediately for critical operations
        saveListTodos(selectedListId, doc).catch((error) => {
          debugLogger.log('error', 'Failed to save todos immediately', error);
        });
      } else {
        // Debounced save
        if (todosSaveTimerRef.current) {
          window.clearTimeout(todosSaveTimerRef.current);
        }
        todosSaveTimerRef.current = window.setTimeout(() => {
          saveListTodos(selectedListId, doc).catch((error) => {
            debugLogger.log(
              'error',
              'Failed to save todos with debounce',
              error,
            );
          });
          todosSaveTimerRef.current = null;
        }, delay);
      }
    },
    [lists, selectedListId, loadedListsRef],
  );

  // Deterministic flush of current list todos: cancels debounce and awaits save
  const flushCurrentTodos = React.useCallback(async (): Promise<boolean> => {
    const listId = selectedListIdRef.current;
    if (!listId) return false;
    if (!loadedListsRef.current.has(listId)) return false;
    const snapshot = listsRef.current.find((l) => l.id === listId);
    if (!snapshot) return false;

    // Cancel any pending debounced save
    if (todosSaveTimerRef.current) {
      window.clearTimeout(todosSaveTimerRef.current);
      todosSaveTimerRef.current = null;
    }

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
  }, [selectedListIdRef, loadedListsRef, listsRef]);

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
          isCached: loadedListsRef.current.has(selectedListId),
          hasTodos: current.todos && current.todos.length > 0,
        },
      );

      // Skip loading if list is already cached and has todos
      if (
        loadedListsRef.current.has(selectedListId) &&
        current.todos &&
        current.todos.length > 0
      ) {
        debugLogger.log('info', 'List todos already cached, skipping load');
        return;
      }

      // Skip loading if list already has todos (from previous load)
      if (current.todos && current.todos.length > 0) {
        loadedListsRef.current.add(selectedListId);
        debugLogger.log('info', 'List already has todos, marking as cached');
        return;
      }

      debugLogger.log('info', 'Loading todos for selected list', {
        selectedListId,
      });
      const fetched = await loadListTodos(selectedListId);
      const todosNorm = (fetched.todos || []).map((t: any, i: number) => ({
        id: typeof t.id === 'number' ? t.id : i + 1,
        text: typeof t.text === 'string' ? t.text : String(t.text ?? ''),
        completed: Boolean((t as any).completed ?? (t as any).checked ?? false),
        indent: Math.max(0, Math.min(1, Number((t as any).indent ?? 0))),
      }));

      if (todosNorm.length === 0) {
        const firstId = nextId();
        const seed = [{ id: firstId, text: '', completed: false, indent: 0 }];
        setLists((prev) =>
          prev.map((l) =>
            l.id === selectedListId ? { ...l, todos: seed } : l,
          ),
        );
        loadedListsRef.current.add(selectedListId);
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
        loadedListsRef.current.add(selectedListId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (todosSaveTimerRef.current) {
        window.clearTimeout(todosSaveTimerRef.current);
      }
    };
  }, []);

  // Ensure pending debounced saves flush on app/window close or hide
  React.useEffect(() => {
    const flushSaves = () => {
      // Force an immediate save of current list's todos
      saveWithStrategy('immediate');
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
  }, [saveWithStrategy]);

  return {
    saveWithStrategy,
    flushCurrentTodos,
  } as const;
}
