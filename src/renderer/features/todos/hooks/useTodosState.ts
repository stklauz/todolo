import React from 'react';
import { loadListsIndex, saveListsIndex, loadListTodos, saveListTodos } from '../api/storage';
import type { EditorTodo, TodoList } from '../types';

type State = {
  lists: TodoList[];
  selectedListId: string | null;
};

export default function useTodosState() {
  const [lists, setLists] = React.useState<TodoList[]>([]);
  const [selectedListId, setSelectedListId] = React.useState<string | null>(null);
  const idCounterRef = React.useRef(1);
  const saveTimerRef = React.useRef<number | null>(null);
  const todosSaveTimerRef = React.useRef<number | null>(null);
  const selectedListIdRef = React.useRef<string | null>(null);
  const loadedListsRef = React.useRef<Set<string>>(new Set());
  selectedListIdRef.current = selectedListId;

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
        // ignore
      }
    };
    load();
  }, []);

  // Ensure at least one list exists
  React.useEffect(() => {
    if (lists.length === 0) {
      const id = crypto?.randomUUID?.() || String(Date.now());
      setLists([{ id, name: 'My Todos', todos: [] }]);
      setSelectedListId(id);
    } else if (!selectedListId) {
      setSelectedListId(lists[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists.length]);

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
        void saveListsIndex(indexDoc);
      } catch {}
    }, 800);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [lists, selectedListId]);

  // Smart save function with different strategies
  const saveWithStrategy = React.useCallback((type: 'immediate' | 'debounced', delay = 200) => {
    if (!selectedListId) return;
    
    const selected = lists.find((l) => l.id === selectedListId);
    if (!selected) return;
    
    const doc = { version: 2, todos: selected.todos } as const;
    
    if (type === 'immediate') {
      // Clear any pending debounced saves
      if (todosSaveTimerRef.current) {
        window.clearTimeout(todosSaveTimerRef.current);
        todosSaveTimerRef.current = null;
      }
      // Save immediately
      void saveListTodos(selectedListId, doc);
    } else {
      // Debounced save
      if (todosSaveTimerRef.current) {
        window.clearTimeout(todosSaveTimerRef.current);
      }
      todosSaveTimerRef.current = window.setTimeout(() => {
        void saveListTodos(selectedListId, doc);
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
      // Only trigger save if something actually changed
      if (updated !== prev) {
        saveWithStrategy('debounced', 200);
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
    setSelectedTodos((prev) => [...prev, { id, text, completed: false, indent: 0 }]);
    // Add operations should be immediate
    saveWithStrategy('immediate');
    return id;
  }

  // Lazy-load selected list todos when selection changes (with caching)
  React.useEffect(() => {
    const run = async () => {
      if (!selectedListId) return;
      const current = lists.find((l) => l.id === selectedListId);
      if (!current) return;
      
      // Skip loading if list is already cached and has todos
      if (loadedListsRef.current.has(selectedListId) && current.todos && current.todos.length > 0) {
        return;
      }
      
      // Skip loading if list already has todos (from previous load)
      if (current.todos && current.todos.length > 0) {
        loadedListsRef.current.add(selectedListId);
        return;
      }
      
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
        void saveListTodos(selectedListId, { version: 2, todos: seed });
      } else {
        setLists((prev) => prev.map((l) => (l.id === selectedListId ? { ...l, todos: todosNorm } : l)));
        loadedListsRef.current.add(selectedListId);
        const maxId = todosNorm.reduce((m, t) => (t.id > m ? t.id : m), 0);
        idCounterRef.current = Math.max(idCounterRef.current, maxId + 1);
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

  function addList(): string {
    const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
    const idx = lists.length + 1;
    const name = `List ${idx}`;
    const now = new Date().toISOString();
    setLists((prev) => [...prev, { id, name, todos: [], createdAt: now, updatedAt: now }]);
    setSelectedListId(id);
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
