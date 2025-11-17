// import React from 'react'; // Not needed in this file
import type { EditorTodo } from '../types';
import {
  reparentChildren,
  outdentChildren,
  deriveIndentFromParentId,
  computeParentForIndentChange,
  clampIndent,
} from '../utils/todoUtils';
import { MIN_INDENT } from '../utils/constants';
import { debugLogger } from '../../../utils/debug';

type UseTodosOperationsProps = {
  setSelectedTodos: (
    updater: (prev: EditorTodo[]) => EditorTodo[] | null | undefined,
  ) => void;
  saveWithStrategy: (type: 'immediate' | 'debounced', delay?: number) => void;
  nextId: () => number;
};

/* eslint-disable no-loop-func */
const isDescendantInList = (
  list: EditorTodo[],
  candidateId: number,
  ancestorId: number,
): boolean => {
  let current: EditorTodo | undefined = list.find((t) => t.id === candidateId);
  const guard = new Set<number>();
  while (current && current.parentId != null) {
    if (guard.has(current.id)) break; // safety against cycles
    guard.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = list.find((t) => t.id === (current as EditorTodo).parentId!);
  }
  return false;
};
/* eslint-enable no-loop-func */

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

      // Update the toggled item
      next[idx] = {
        ...cur,
        completed: newCompleted,
      };

      // If toggling a parent (identified by parentId === null), apply to descendants.
      if (cur.parentId == null) {
        // Prefer explicit parentId relationships when present
        const anyLinkedChild = next.some((t) => t.parentId === cur.id);
        if (anyLinkedChild) {
          for (let i = 0; i < next.length; i++) {
            if (
              next[i].id !== cur.id &&
              isDescendantInList(next, next[i].id, cur.id)
            ) {
              next[i] = {
                ...next[i],
                completed: newCompleted,
              };
            }
          }
        } else {
          // Fallback for legacy data: use indent-based consecutive children block
          for (let i = idx + 1; i < next.length; i++) {
            const ind = Number(next[i].indent ?? 0);
            if (ind === 0) break;
            next[i] = {
              ...next[i],
              completed: newCompleted,
            };
          }
        }
      } else {
        // If toggling a child, optionally ensure section consistency with parent if needed.
        // We do not force parent toggle here; parent effective section is computed in UI.
      }

      // Batch completion saves to avoid main-thread stalls
      saveWithStrategy('debounced', 75);
      return next;
    });
  }

  /**
   * Sets indent by manipulating parentId (indent is display-only).
   * - indent === 0: outdent (set parentId = null)
   * - indent === 1: indent (find nearest previous top-level active parent and attach)
   */
  function setIndent(id: number, indent: number) {
    const clamped = clampIndent(indent | 0);
    setSelectedTodos((prev) => {
      const targetIndex = prev.findIndex((t) => t.id === id);
      if (targetIndex === -1) return prev;

      const target = prev[targetIndex];
      const currentIndent = deriveIndentFromParentId(target);

      // Only update if indent actually changed
      if (currentIndent === clamped) return prev;

      const updated = [...prev];

      // Use shared utility to compute parent
      const newParentId = computeParentForIndentChange(prev, id, clamped);

      // If no valid parent found, still allow visual indent (display-only)
      updated[targetIndex] =
        newParentId == null
          ? {
              ...target,
              parentId: clamped === MIN_INDENT ? null : undefined,
              indent: clamped,
            }
          : { ...target, parentId: newParentId, indent: clamped };
      debugLogger.log('info', 'Operations: setIndent', {
        todoId: id,
        previousIndent: currentIndent,
        requestedIndent: clamped,
        appliedIndent: updated[targetIndex].indent,
        parentId: newParentId,
      });

      // Only trigger save if something actually changed
      if (updated !== prev) {
        saveWithStrategy('debounced', 200);
      }
      return updated;
    });
  }

  /**
   * Changes indent by delta, delegating to setIndent.
   */
  function changeIndent(id: number, delta: number) {
    setSelectedTodos((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;

      const currentIndent = deriveIndentFromParentId(target);
      const newIndent = clampIndent(currentIndent + delta);

      // Only update if indent would actually change
      if (currentIndent === newIndent) return prev;

      // Use shared utility to compute parent (inline to avoid double save)
      const targetIndex = prev.findIndex((t) => t.id === id);
      const updated = [...prev];

      const newParentId = computeParentForIndentChange(prev, id, newIndent);

      // If no valid parent found, still allow visual indent (display-only)
      updated[targetIndex] =
        newParentId == null
          ? {
              ...target,
              parentId: newIndent === MIN_INDENT ? null : undefined,
              indent: newIndent,
            }
          : { ...target, parentId: newParentId, indent: newIndent };
      debugLogger.log('info', 'Operations: changeIndent', {
        todoId: id,
        previousIndent: currentIndent,
        requestedDelta: delta,
        appliedIndent: updated[targetIndex].indent,
        parentId: newParentId,
      });

      saveWithStrategy('debounced', 200);
      return updated;
    });
  }

  function insertTodoBelow(index: number, text = ''): number {
    const id = nextId();
    setSelectedTodos((prev) => {
      // Defensive check for duplicate IDs
      if (prev.some((t) => t.id === id)) {
        const maxId = prev.reduce((m, t) => (t.id > m ? t.id : m), 0);
        const errorMsg = `Duplicate ID ${id} detected. Max ID in list: ${maxId}. Counter was out of sync.`;

        debugLogger.log('error', 'Duplicate todo ID detected', {
          duplicateId: id,
          existingIds: prev.map((t) => t.id),
          maxId,
        });

        // In development, throw to catch in tests
        if (process.env.NODE_ENV !== 'production') {
          throw new Error(`[BUG] ${errorMsg}`);
        }

        // In production, log but don't crash - skip the operation
        debugLogger.log('error', '[BUG] Duplicate todo ID detected', {
          message: errorMsg,
        });
        return prev;
      }

      const next = [...prev];
      const baseTodo = prev[index];
      const baseParentId = baseTodo?.parentId ?? null;
      let indentLevel = MIN_INDENT;
      if (baseParentId != null) {
        const parent = prev.find((t) => t.id === baseParentId);
        const parentIndent = parent
          ? deriveIndentFromParentId(parent)
          : MIN_INDENT;
        indentLevel = clampIndent(parentIndent + 1);
      }
      next.splice(index + 1, 0, {
        id,
        text,
        completed: false,
        parentId: baseParentId,
        indent: indentLevel,
      });
      return next;
    });
    // Batch add saves to avoid main-thread stalls
    saveWithStrategy('debounced', 75);
    return id;
  }

  function removeTodoAt(index: number) {
    setSelectedTodos((prev) => {
      const next = [...prev];
      const removed = next[index];
      if (!removed) return prev;
      // Remove the item
      next.splice(index, 1);
      // If removed item was a parent (parentId === null), reparent/outdent its immediate children
      if (removed.parentId == null) {
        // Find nearest previous ACTIVE parent candidate in the updated array
        let newParentId: number | null = null;
        for (let i = Math.min(index, next.length - 1); i >= 0; i--) {
          const cand = next[i];
          if (cand && cand.parentId == null && !cand.completed) {
            newParentId = cand.id;
            break;
          }
        }
        const updated =
          newParentId == null
            ? outdentChildren(removed.id, next)
            : reparentChildren(removed.id, newParentId, next);
        return updated;
      }
      // If removed item was a child, no hierarchy mass-change needed

      return next;
    });
    // Batch delete saves to avoid main-thread stalls
    saveWithStrategy('debounced', 75);
  }

  return {
    updateTodo,
    toggleTodo,
    setIndent,
    changeIndent,
    insertTodoBelow,
    removeTodoAt,
  } as const;
}
