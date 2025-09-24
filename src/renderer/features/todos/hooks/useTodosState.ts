import React from 'react';
import { loadAppData, saveAppData } from '../api/storage';
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

  // Load on mount
  React.useEffect(() => {
    const load = async () => {
      try {
        const data = await loadAppData();
        const normalizedLists: TodoList[] = (data.lists || []).map((list, li) => {
          const todosNorm: EditorTodo[] = (list.todos || []).map((t: any, i: number) => ({
            id: typeof t.id === 'number' ? t.id : i + 1,
            text: typeof t.text === 'string' ? t.text : String(t.text ?? ''),
            completed: Boolean((t as any).completed ?? (t as any).checked ?? false),
            indent: Math.max(0, Math.min(1, Number((t as any).indent ?? 0))),
          }));
          return {
            id: typeof list.id === 'string' ? list.id : String(li + 1),
            name: typeof list.name === 'string' ? list.name : `List ${li + 1}`,
            todos: todosNorm,
            createdAt: list.createdAt,
            updatedAt: (list as any).updatedAt ?? list.createdAt ?? undefined,
          };
        });
        setLists(normalizedLists);
        const maxId = normalizedLists.reduce((m, l) => {
          const localMax = l.todos.reduce((mm, t) => (t.id > mm ? t.id : mm), 0);
          return Math.max(m, localMax);
        }, 0);
        idCounterRef.current = maxId + 1;
        setSelectedListId(
          (data.selectedListId && normalizedLists.some((l) => l.id === data.selectedListId))
            ? data.selectedListId!
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

  // Debounced save
  React.useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        saveAppData({ version: 1, lists, selectedListId: selectedListId ?? undefined });
      } catch {}
    }, 400);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
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
      setLists((prevLists) =>
        prevLists.map((l) => {
          if (l.id !== selectedListId) return l;
          const updated = updater(l.todos);
          if (!updated) return l;
          return { ...l, todos: updated, updatedAt: new Date().toISOString() };
        }),
      );
    },
    [selectedListId],
  );

  // Mutations
  function updateTodo(id: number, text: string) {
    setSelectedTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
  }
  function toggleTodo(id: number) {
    setSelectedTodos((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const cur = next[idx];
      const newCompleted = !cur.completed;
      next[idx] = { ...cur, completed: newCompleted };
      // If toggling a parent (indent 0), apply to all consecutive children
      if (Number(cur.indent ?? 0) === 0) {
        for (let i = idx + 1; i < next.length; i++) {
          const ind = Number(next[i].indent ?? 0);
          if (ind === 0) break;
          next[i] = { ...next[i], completed: newCompleted };
        }
      }
      return next;
    });
  }
  function setIndent(id: number, indent: number) {
    const clamped = Math.max(0, Math.min(1, indent | 0));
    setSelectedTodos((prev) => prev.map((t) => (t.id === id ? { ...t, indent: clamped } : t)));
  }
  function changeIndent(id: number, delta: number) {
    setSelectedTodos((prev) => prev.map((t) => (t.id === id
      ? { ...t, indent: Math.max(0, Math.min(1, Number(t.indent ?? 0) + delta)) }
      : t)));
  }
  function insertTodoBelow(index: number, text = ''): number {
    const id = nextId();
    setSelectedTodos((prev) => {
      const next = [...prev];
      const baseIndent = Math.max(0, Math.min(1, Number(prev[index]?.indent ?? 0)));
      next.splice(index + 1, 0, { id, text, completed: false, indent: baseIndent });
      return next;
    });
    return id;
  }
  function removeTodoAt(index: number) {
    setSelectedTodos((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }
  function addTodoAtEnd(text: string): number {
    const id = nextId();
    setSelectedTodos((prev) => [...prev, { id, text, completed: false, indent: 0 }]);
    return id;
  }

  // Ensure selected list always has at least one todo
  React.useEffect(() => {
    const selected = lists.find((l) => l.id === selectedListId);
    if (!selected) return;
    if (selected.todos.length === 0) {
      const id = nextId();
      setSelectedTodos(() => [{ id, text: '', completed: false, indent: 0 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, selectedListId]);

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
  }

  function deleteList(id: string) {
    setLists((prev) => {
      const remaining = prev.filter((l) => l.id !== id);
      // if we deleted the selected list, update selection
      setSelectedListId((sel) => (sel === id ? remaining[0]?.id ?? null : sel));
      return remaining;
    });
  }

  return {
    lists,
    setLists,
    selectedListId,
    setSelectedListId,
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
