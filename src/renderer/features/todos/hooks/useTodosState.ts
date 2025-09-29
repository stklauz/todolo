import React from 'react';
import { loadListsIndex, saveListsIndex, loadListTodos, saveListTodos } from '../api/storage';
import type { EditorTodo, TodoList } from '../types';
import { debugLogger } from '../../../utils/debug';

type State = {
  lists: TodoList[];
  selectedListId: string | null;
};

export default function useTodosState() {
  const [lists, setLists] = React.useState<TodoList[]>([]);
  const [selectedListId, setSelectedListId] = React.useState<string | null>(null);
  const [indexLoaded, setIndexLoaded] = React.useState(false);
  const idCounterRef = React.useRef(1);
  const saveTimerRef = React.useRef<number | null>(null);
  const todosSaveTimerRef = React.useRef<number | null>(null);
  const selectedListIdRef = React.useRef<string | null>(null);
  const listsRef = React.useRef<TodoList[]>([]);
  const loadedListsRef = React.useRef<Set<string>>(new Set());
  selectedListIdRef.current = selectedListId;
  React.useEffect(() => { listsRef.current = lists; }, [lists]);

  // Load lists (index) on mount
  React.useEffect(() => {
    const load = async () => {
      
      try {
        const index = await loadListsIndex();
        
        const normalizedLists: TodoList[] = (index.lists || []).map((list, li) => ({
          id: String(list.id),
          name: typeof list.name === 'string' ? list.name : `List ${li + 1}`,
          todos: [],
          createdAt: list.createdAt,
          updatedAt: list.updatedAt,
        }));
        setLists(normalizedLists);
        setSelectedListId(
          (index.selectedListId && normalizedLists.some((l) => l.id === index.selectedListId))
            ? index.selectedListId!
            : normalizedLists[0]?.id ?? null,
        );
        
      } catch (e) {
        
      } finally {
        setIndexLoaded(true);
      }
    };
    load();
  }, []);

  // Ensure at least one list exists (guard against StrictMode double-invoke)
  const initialListCreatedRef = React.useRef(false);
  const listCreationInProgressRef = React.useRef(false);
  React.useEffect(() => {
    // Only create a list after the index load completes
    if (!indexLoaded) return;
    // Only create a list if we have NO lists AND haven't already created one AND not currently creating one
    if (lists.length === 0 && !initialListCreatedRef.current && !listCreationInProgressRef.current) {
      
      initialListCreatedRef.current = true;
      listCreationInProgressRef.current = true;
      const id = crypto?.randomUUID?.() || String(Date.now());
      const newList = { id, name: 'My Todos', todos: [], createdAt: new Date().toISOString() } as TodoList;
      setLists([newList]);
      setSelectedListId(id);
      // Save immediately to ensure persistence
      const indexDoc = { version: 2 as const, lists: [{ id: newList.id, name: newList.name, createdAt: newList.createdAt!, updatedAt: newList.updatedAt }], selectedListId: id };
      saveListsIndex(indexDoc).then(() => {
        
        listCreationInProgressRef.current = false;
      }).catch((error) => {
        
        debugLogger.log('error', 'Failed to save initial list', error);
        listCreationInProgressRef.current = false;
      });
    } else if (!selectedListId && lists.length > 0) {
      
      setSelectedListId(lists[0].id);
    } else {
      
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexLoaded, lists.length]);

  // Debounced save of lists index (names/order/selection, not todos)
  React.useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        const indexDoc = {
          version: 2,
          lists: lists.map((l) => ({ id: l.id, name: l.name, createdAt: l.createdAt!, updatedAt: l.updatedAt })),
          selectedListId: selectedListId ?? undefined,
        } as const;
        
        saveListsIndex(indexDoc).catch((error) => {
          debugLogger.log('error', 'Failed to save lists index', error);
        });
      } catch {}
    }, 800);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [lists, selectedListId]);

  // Ensure initial selection is persisted immediately after it is determined
  // so the same list opens after restart.
  React.useEffect(() => {
    if (!selectedListId || lists.length === 0) return;
    try {
      const indexDoc = {
        version: 2 as const,
        lists: lists.map((l) => ({ id: l.id, name: l.name, createdAt: l.createdAt!, updatedAt: l.updatedAt })),
        selectedListId,
      };
      
      saveListsIndex(indexDoc).catch(() => {});
    } catch {}
  }, [selectedListId, lists.length]);

  // Flush lists index immediately on window close/blur/hidden, to avoid losing debounced changes
  React.useEffect(() => {
    const flushIndex = () => {
      try {
        const snapshot = listsRef.current;
        const sel = selectedListIdRef.current;
        if (!snapshot || snapshot.length === 0) return;
        const indexDoc = {
          version: 2 as const,
          lists: snapshot.map((l) => ({ id: l.id, name: l.name, createdAt: l.createdAt!, updatedAt: l.updatedAt })),
          selectedListId: sel ?? undefined,
        };
        saveListsIndex(indexDoc).catch((error) => {
          debugLogger.log('error', 'Failed to save lists index', error);
        });
      } catch {}
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushIndex(); };
    window.addEventListener('beforeunload', flushIndex);
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', flushIndex);
    return () => {
      window.removeEventListener('beforeunload', flushIndex);
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', flushIndex);
    };
  }, []);

  // Smart save function with different strategies
  const saveWithStrategy = React.useCallback((type: 'immediate' | 'debounced', delay = 200) => {
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
      todos: selected.todos
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
          debugLogger.log('error', 'Failed to save todos with debounce', error);
        });
        todosSaveTimerRef.current = null;
      }, delay);
    }
  }, [lists, selectedListId]);

  // Helpers
  const nextId = () => {
    const id = idCounterRef.current;
    idCounterRef.current += 1;
    return id;
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

  // Mutations
  function updateTodo(id: number, text: string) {
    
    setSelectedTodos((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          // Only update if text actually changed
          if (t.text === text) return t;
          
          return { ...t, text };
        }
        return t;
      });
      // Only trigger save if something actually changed AND the text is not empty
      if (updated !== prev && text.trim() !== '') {
        
        saveWithStrategy('debounced', 200);
      } else if (updated !== prev && text.trim() === '') {
        
      }
      return updated;
    });
  }
  function toggleTodo(id: number) {
    setSelectedTodos((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const cur = next[idx];
      const newCompleted = !cur.completed;
      
      // Only update if completion status actually changed
      if (cur.completed === newCompleted) return prev;
      
      next[idx] = { ...cur, completed: newCompleted };
      // If toggling a parent (indent 0), apply to all consecutive children
      if (Number(cur.indent ?? 0) === 0) {
        for (let i = idx + 1; i < next.length; i++) {
          const ind = Number(next[i].indent ?? 0);
          if (ind === 0) break;
          next[i] = { ...next[i], completed: newCompleted };
        }
      }
      // Todo completion should be immediate
      saveWithStrategy('immediate');
      return next;
    });
  }
  function setIndent(id: number, indent: number) {
    const clamped = Math.max(0, Math.min(1, indent | 0));
    setSelectedTodos((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          // Only update if indent actually changed
          if (t.indent === clamped) return t;
          return { ...t, indent: clamped };
        }
        return t;
      });
      // Only trigger save if something actually changed
      if (updated !== prev) {
        saveWithStrategy('debounced', 200);
      }
      return updated;
    });
  }
  function changeIndent(id: number, delta: number) {
    setSelectedTodos((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          const newIndent = Math.max(0, Math.min(1, Number(t.indent ?? 0) + delta));
          // Only update if indent actually changed
          if (t.indent === newIndent) return t;
          return { ...t, indent: newIndent };
        }
        return t;
      });
      // Only trigger save if something actually changed
      if (updated !== prev) {
        saveWithStrategy('debounced', 200);
      }
      return updated;
    });
  }
  function insertTodoBelow(index: number, text = ''): number {
    const id = nextId();
    setSelectedTodos((prev) => {
      const next = [...prev];
      const baseIndent = Math.max(0, Math.min(1, Number(prev[index]?.indent ?? 0)));
      next.splice(index + 1, 0, { id, text, completed: false, indent: baseIndent });
      return next;
    });
    // Add operations should be immediate
    saveWithStrategy('immediate');
    return id;
  }
  function removeTodoAt(index: number) {
    setSelectedTodos((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    // Delete operations should be immediate
    saveWithStrategy('immediate');
  }
  function addTodoAtEnd(text: string): number {
    const id = nextId();
    console.log(`[UI] addTodoAtEnd called - id: ${id}, text: "${text}"`);
    setSelectedTodos((prev) => {
      const newTodo = { id, text, completed: false, indent: 0 };
      console.log(`[UI] Adding new todo:`, newTodo);
      return [...prev, newTodo];
    });
    // Only save if the text is not empty - empty todos should not be saved
    if (text.trim() !== '') {
      console.log(`[UI] Saving new todo with non-empty text: "${text}"`);
      saveWithStrategy('immediate');
    } else {
      console.log(`[UI] Skipping save for empty todo text`);
    }
    return id;
  }

  // Lazy-load selected list todos when selection changes (with caching)
  React.useEffect(() => {
    const run = async () => {
      if (!selectedListId) return;
      const current = lists.find((l) => l.id === selectedListId);
      if (!current) return;
      
      debugLogger.log('info', 'List selection changed - checking if todos need loading', { 
        selectedListId,
        isCached: loadedListsRef.current.has(selectedListId),
        hasTodos: current.todos && current.todos.length > 0
      });
      
      // Skip loading if list is already cached and has todos
      if (loadedListsRef.current.has(selectedListId) && current.todos && current.todos.length > 0) {
        debugLogger.log('info', 'List todos already cached, skipping load');
        return;
      }
      
      // Skip loading if list already has todos (from previous load)
      if (current.todos && current.todos.length > 0) {
        loadedListsRef.current.add(selectedListId);
        debugLogger.log('info', 'List already has todos, marking as cached');
        return;
      }
      
      debugLogger.log('info', 'Loading todos for selected list', { selectedListId });
      const fetched = await loadListTodos(selectedListId);
      const todosNorm: EditorTodo[] = (fetched.todos || []).map((t: any, i: number) => ({
        id: typeof t.id === 'number' ? t.id : i + 1,
        text: typeof t.text === 'string' ? t.text : String(t.text ?? ''),
        completed: Boolean((t as any).completed ?? (t as any).checked ?? false),
        indent: Math.max(0, Math.min(1, Number((t as any).indent ?? 0))),
      }));
      
      if (todosNorm.length === 0) {
        const firstId = nextId();
        const seed = [{ id: firstId, text: '', completed: false, indent: 0 }];
        setLists((prev) => prev.map((l) => (l.id === selectedListId ? { ...l, todos: seed } : l)));
        loadedListsRef.current.add(selectedListId);
        saveListTodos(selectedListId, { version: 2, todos: seed }).catch((error) => {
          debugLogger.log('error', 'Failed to save seed todos', error);
        });
        debugLogger.log('info', 'Created new empty list with seed todo', { selectedListId });
      } else {
        setLists((prev) => prev.map((l) => (l.id === selectedListId ? { ...l, todos: todosNorm } : l)));
        loadedListsRef.current.add(selectedListId);
        const maxId = todosNorm.reduce((m, t) => (t.id > m ? t.id : m), 0);
        idCounterRef.current = Math.max(idCounterRef.current, maxId + 1);
        debugLogger.log('info', 'Loaded existing todos for list', { 
          selectedListId, 
          todoCount: todosNorm.length,
          maxId 
        });
      }
    };
    run();
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

  function addList(): string {
    const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
    const idx = lists.length + 1;
    const name = `List ${idx}`;
    const now = new Date().toISOString();
    const newList = { id, name, todos: [], createdAt: now, updatedAt: now };
    setLists((prev) => [...prev, newList]);
    setSelectedListId(id);
    // Persist new list immediately to avoid FK/selection races on restart
    try {
      const snapshot = [...listsRef.current, newList];
      const indexDoc = {
        version: 2 as const,
        lists: snapshot.map((l) => ({ id: l.id, name: l.name, createdAt: l.createdAt!, updatedAt: l.updatedAt })),
        selectedListId: id,
      };
      saveListsIndex(indexDoc).catch(() => {});
    } catch {}
    return id;
  }
  function deleteSelectedList() {
    if (!selectedListId) return;
    setLists((prev) => {
      const remaining = prev.filter((l) => l.id !== selectedListId);
      setSelectedListId(remaining[0]?.id ?? null);
      return remaining;
    });
    // Remove from cache when deleted
    loadedListsRef.current.delete(selectedListId);
  }

  function deleteList(id: string) {
    setLists((prev) => {
      const remaining = prev.filter((l) => l.id !== id);
      // if we deleted the selected list, update selection
      setSelectedListId((sel) => (sel === id ? remaining[0]?.id ?? null : sel));
      return remaining;
    });
    // Remove from cache when deleted
    loadedListsRef.current.delete(id);
  }

  // Custom setSelectedListId that triggers immediate save
  const setSelectedListIdWithSave = React.useCallback((id: string | null) => {
    setSelectedListId(id);
    // List switching should be immediate
    saveWithStrategy('immediate');
    // Persist selection in index immediately to keep it across restarts
    try {
      const snapshot = listsRef.current;
      if (snapshot && snapshot.length > 0) {
        const indexDoc = {
          version: 2 as const,
          lists: snapshot.map((l) => ({ id: l.id, name: l.name, createdAt: l.createdAt!, updatedAt: l.updatedAt })),
          selectedListId: id ?? undefined,
        };
        saveListsIndex(indexDoc).catch(() => {});
      }
    } catch {}
  }, [saveWithStrategy]);

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
    addTodoAtEnd,
    addList,
    deleteSelectedList,
    deleteList,
  } as const;
}
