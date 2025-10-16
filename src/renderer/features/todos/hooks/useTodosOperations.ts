// import React from 'react'; // Not needed in this file
import type { EditorTodo } from '../types';

type UseTodosOperationsProps = {
  setSelectedTodos: (
    updater: (prev: EditorTodo[]) => EditorTodo[] | null | undefined,
  ) => void;
  saveWithStrategy: (type: 'immediate' | 'debounced', delay?: number) => void;
  nextId: () => number;
};

export default function useTodosOperations({
  setSelectedTodos,
  saveWithStrategy,
  nextId,
}: UseTodosOperationsProps) {
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
          const newIndent = Math.max(
            0,
            Math.min(1, Number(t.indent ?? 0) + delta),
          );
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
      const baseIndent = Math.max(
        0,
        Math.min(1, Number(prev[index]?.indent ?? 0)),
      );
      next.splice(index + 1, 0, {
        id,
        text,
        completed: false,
        indent: baseIndent,
      });
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

  return {
    updateTodo,
    toggleTodo,
    setIndent,
    changeIndent,
    insertTodoBelow,
    removeTodoAt,
    addTodoAtEnd,
  } as const;
}
