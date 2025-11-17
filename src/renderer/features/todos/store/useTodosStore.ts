import { create } from 'zustand';
import type { TodoList, EditorTodo } from '../types';
import {
  reparentChildren,
  outdentChildren,
  deriveIndentFromParentId,
  computeParentForIndentChange,
  clampIndent,
} from '../utils/todoUtils';
import { MIN_INDENT } from '../utils/constants';
import {
  duplicateList as duplicateListApi,
  deleteList as deleteListApi,
} from '../api/storage';
import { debugLogger } from '../../../utils/debug';
import { sortListsByRecency } from '../utils/listOrdering';

/**
 * Centralized Todos Store (Phase 5: Eliminate Ref Plumbing)
 *
 * Replaces:
 * - lists/setLists state
 * - selectedListId/setSelectedListId state
 * - listsRef, selectedListIdRef refs
 * - loadedListsRef ref
 * - idCounter management
 *
 * Benefits:
 * - Zero prop drilling
 * - No ref plumbing
 * - Single source of truth
 * - Simpler hook signatures
 */

type TodosState = {
  // Core state
  lists: TodoList[];
  selectedListId: string | null;
  indexLoaded: boolean;

  // Internal tracking (replaces refs)
  loadedLists: Set<string>;
  idCounter: number;

  // Actions: Lists
  setLists: (lists: TodoList[] | ((prev: TodoList[]) => TodoList[])) => void;
  setSelectedListId: (id: string | null) => void;
  setIndexLoaded: (loaded: boolean) => void;

  // Actions: Loaded lists tracking
  markListAsLoaded: (listId: string) => void;
  isListLoaded: (listId: string) => boolean;

  // Actions: ID counter
  nextId: () => number;
  syncIdCounter: (maxId: number) => void;

  // Actions: Todos (selected list)
  updateTodo: (id: number, text: string) => void;
  toggleTodo: (id: number) => void;
  setIndent: (id: number, indent: number) => void;
  changeIndent: (id: number, delta: number) => void;
  insertTodoBelow: (index: number, text?: string) => number;
  removeTodoAt: (index: number) => void;

  // Actions: Lists management
  addList: () => string;
  deleteSelectedList: () => void;
  deleteList: (id: string) => Promise<void>;
  renameList: (id: string, name: string) => void;
  updateListMeta: (
    id: string,
    updates: Partial<Pick<TodoList, 'name'>>,
  ) => void;
  duplicateList: (
    sourceListId: string,
    newListName?: string,
  ) => Promise<string | null>;

  // Computed selectors
  getSelectedList: () => TodoList | undefined;
  getListById: (id: string) => TodoList | undefined;
};

export const useTodosStore = create<TodosState>((set, get) => ({
  // Initial state
  lists: [],
  selectedListId: null,
  indexLoaded: false,
  loadedLists: new Set<string>(),
  idCounter: 1,

  // Actions: Lists
  setLists: (listsOrFn) => {
    set((state) => {
      const prevById = new Map(state.lists.map((l) => [l.id, l] as const));
      const newLists =
        typeof listsOrFn === 'function' ? listsOrFn(state.lists) : listsOrFn;
      const sanitized = newLists.reduce<TodoList[]>((acc, list) => {
        const prev = list?.id ? prevById.get(list.id) : undefined;
        let candidate = list as TodoList;
        if (typeof candidate.updatedAt !== 'string') {
          // Attempt to recover from missing timestamp using previous value
          if (prev?.updatedAt) {
            candidate = { ...candidate, updatedAt: prev.updatedAt } as TodoList;
          } else {
            debugLogger.log(
              'warn',
              'Dropping list without updatedAt in setLists',
              {
                id: candidate.id,
              },
            );
            return acc;
          }
        }
        if (typeof candidate.createdAt !== 'string') {
          // Attempt to recover from missing timestamp using previous value
          if (prev?.createdAt) {
            candidate = { ...candidate, createdAt: prev.createdAt } as TodoList;
          } else {
            debugLogger.log(
              'warn',
              'Dropping list without createdAt in setLists',
              {
                id: candidate.id,
              },
            );
            return acc;
          }
        }
        const parsedUpdated = Date.parse(candidate.updatedAt);
        const parsedCreated = Date.parse(candidate.createdAt);
        if (
          !Number.isFinite(parsedUpdated) ||
          !Number.isFinite(parsedCreated)
        ) {
          debugLogger.log(
            'warn',
            'Dropping list with invalid updatedAt in setLists',
            {
              id: candidate.id,
              updatedAt: candidate.updatedAt,
            },
          );
          return acc;
        }
        acc.push({
          ...candidate,
          createdAt: new Date(parsedCreated).toISOString(),
          updatedAt: new Date(parsedUpdated).toISOString(),
        });
        return acc;
      }, []);
      if (sanitized.length !== newLists.length) {
        debugLogger.log(
          'warn',
          'Some lists were discarded due to invalid timestamps',
          {
            requested: newLists.length,
            kept: sanitized.length,
          },
        );
      }
      debugLogger.log('info', 'Store: setLists', {
        count: sanitized.length,
      });
      return { lists: sortListsByRecency(sanitized) };
    });
  },

  setSelectedListId: (id) => {
    debugLogger.log('info', 'Store: setSelectedListId', { id });
    set({ selectedListId: id });
  },

  setIndexLoaded: (loaded) => {
    debugLogger.log('info', 'Store: setIndexLoaded', { loaded });
    set({ indexLoaded: loaded });
  },

  // Actions: Loaded lists tracking
  markListAsLoaded: (listId) => {
    set((state) => {
      const newLoadedLists = new Set(state.loadedLists);
      newLoadedLists.add(listId);
      debugLogger.log('info', 'Store: markListAsLoaded', {
        listId,
        totalLoaded: newLoadedLists.size,
      });
      return { loadedLists: newLoadedLists };
    });
  },

  isListLoaded: (listId) => {
    return get().loadedLists.has(listId);
  },

  // Actions: ID counter
  nextId: () => {
    const current = get().idCounter;
    set({ idCounter: current + 1 });
    debugLogger.log('info', 'Store: nextId', { id: current });
    return current;
  },

  syncIdCounter: (maxId) => {
    set((state) => {
      const newCounter = Math.max(state.idCounter, maxId + 1);
      if (newCounter !== state.idCounter) {
        debugLogger.log('info', 'Store: syncIdCounter', {
          oldCounter: state.idCounter,
          maxId,
          newCounter,
        });
        return { idCounter: newCounter };
      }
      return state;
    });
  },

  // Actions: Todos (selected list)
  updateTodo: (id, text) => {
    if (!Number.isFinite(id) || typeof text !== 'string') return;
    set((state) => {
      const list = state.lists.find((l) => l.id === state.selectedListId);
      if (!list) return state;
      const updatedTodos = list.todos.map((t) =>
        t.id === id ? (t.text === text ? t : { ...t, text }) : t,
      );
      if (updatedTodos === list.todos) return state;
      const updatedLists = state.lists.map((l) =>
        l.id === list.id
          ? { ...l, todos: updatedTodos, updatedAt: new Date().toISOString() }
          : l,
      );
      // Note: persistence is handled by hooks queue; store does pure state
      return {
        ...state,
        lists: sortListsByRecency(updatedLists),
      } as TodosState;
    });
  },

  toggleTodo: (id) => {
    set((state) => {
      const list = state.lists.find((l) => l.id === state.selectedListId);
      if (!list) return state;
      const idx = list.todos.findIndex((t) => t.id === id);
      if (idx === -1) return state;

      const next = [...list.todos];
      const cur = next[idx];
      const newCompleted = !cur.completed;
      if (cur.completed === newCompleted) return state;

      next[idx] = { ...cur, completed: newCompleted };
      if (cur.parentId == null) {
        const anyLinkedChild = next.some((t) => t.parentId === cur.id);
        if (anyLinkedChild) {
          for (let i = 0; i < next.length; i++) {
            if (next[i].id !== cur.id) {
              const targetId = cur.id;
              // descendant check via parentId chain
              let current: EditorTodo | undefined = next.find(
                (t) => t.id === next[i].id,
              );
              const guard = new Set<number>();
              let isDesc = false;
              while (current && current.parentId != null) {
                if (guard.has(current.id)) break;
                guard.add(current.id);
                if (current.parentId === targetId) {
                  isDesc = true;
                  break;
                }
                const { parentId } = current;
                current = next.find((t) => t.id === parentId);
              }
              if (isDesc) next[i] = { ...next[i], completed: newCompleted };
            }
          }
        } else {
          for (let i = idx + 1; i < next.length; i++) {
            const ind = Number(next[i].indent ?? 0);
            if (ind === 0) break;
            next[i] = { ...next[i], completed: newCompleted };
          }
        }
      }

      const updatedLists = state.lists.map((l) =>
        l.id === list.id
          ? { ...l, todos: next, updatedAt: new Date().toISOString() }
          : l,
      );
      return {
        ...state,
        lists: sortListsByRecency(updatedLists),
      } as TodosState;
    });
  },

  setIndent: (id, indent) => {
    const clamped = clampIndent(indent | 0);
    set((state) => {
      const list = state.lists.find((l) => l.id === state.selectedListId);
      if (!list) return state;
      const targetIndex = list.todos.findIndex((t) => t.id === id);
      if (targetIndex === -1) return state;

      const target = list.todos[targetIndex];
      const currentIndent = deriveIndentFromParentId(target);
      if (currentIndent === clamped) return state;

      const updated = [...list.todos];
      const newParentId = computeParentForIndentChange(list.todos, id, clamped);
      updated[targetIndex] =
        newParentId == null
          ? {
              ...target,
              parentId: clamped === MIN_INDENT ? null : undefined,
              indent: clamped,
            }
          : { ...target, parentId: newParentId, indent: clamped };
      const appliedIndent = updated[targetIndex].indent;
      debugLogger.log('info', 'Store: setIndent', {
        todoId: id,
        previousIndent: currentIndent,
        requestedIndent: clamped,
        appliedIndent,
        parentId: newParentId,
      });

      const updatedLists = state.lists.map((l) =>
        l.id === list.id
          ? { ...l, todos: updated, updatedAt: new Date().toISOString() }
          : l,
      );
      return {
        ...state,
        lists: sortListsByRecency(updatedLists),
      } as TodosState;
    });
  },

  changeIndent: (id, delta) => {
    set((state) => {
      const list = state.lists.find((l) => l.id === state.selectedListId);
      if (!list) return state;
      const target = list.todos.find((t) => t.id === id);
      if (!target) return state;
      const currentIndent = deriveIndentFromParentId(target);
      const newIndent = clampIndent(currentIndent + delta);
      if (currentIndent === newIndent) return state;

      const targetIndex = list.todos.findIndex((t) => t.id === id);
      const updated = [...list.todos];
      const newParentId = computeParentForIndentChange(
        list.todos,
        id,
        newIndent,
      );
      updated[targetIndex] =
        newParentId == null
          ? {
              ...target,
              parentId: newIndent === MIN_INDENT ? null : undefined,
              indent: newIndent,
            }
          : { ...target, parentId: newParentId, indent: newIndent };
      debugLogger.log('info', 'Store: changeIndent', {
        todoId: id,
        previousIndent: currentIndent,
        requestedDelta: delta,
        appliedIndent: updated[targetIndex].indent,
        parentId: newParentId,
      });

      const updatedLists = state.lists.map((l) =>
        l.id === list.id
          ? { ...l, todos: updated, updatedAt: new Date().toISOString() }
          : l,
      );
      return {
        ...state,
        lists: sortListsByRecency(updatedLists),
      } as TodosState;
    });
  },

  insertTodoBelow: (index, text = '') => {
    const id = get().nextId();
    set((state) => {
      const list = state.lists.find((l) => l.id === state.selectedListId);
      if (!list) return state;
      if (list.todos.some((t) => t.id === id)) {
        debugLogger.log('error', 'Duplicate todo ID detected', { id });
        return state;
      }

      const next = [...list.todos];
      const baseTodo = next[index];
      const baseParentId = baseTodo?.parentId ?? null;
      let indentLevel = MIN_INDENT;
      if (baseParentId != null) {
        const parent = list.todos.find((t) => t.id === baseParentId);
        const parentIndent = parent
          ? deriveIndentFromParentId(parent)
          : MIN_INDENT;
        indentLevel = clampIndent(parentIndent + 1);
      }
      const newTodo: EditorTodo = {
        id,
        text,
        completed: false,
        parentId: baseParentId,
        indent: indentLevel,
      };
      next.splice(index + 1, 0, newTodo);

      const updatedLists = state.lists.map((l) =>
        l.id === list.id
          ? { ...l, todos: next, updatedAt: new Date().toISOString() }
          : l,
      );
      return {
        ...state,
        lists: sortListsByRecency(updatedLists),
      } as TodosState;
    });
    return id;
  },

  removeTodoAt: (index) => {
    set((state) => {
      const list = state.lists.find((l) => l.id === state.selectedListId);
      if (!list) return state;
      const next = [...list.todos];
      const removed = next[index];
      if (!removed) return state;
      next.splice(index, 1);
      if (removed.parentId == null) {
        let newParentId: number | null = null;
        // 1) nearest previous active top-level
        for (let i = Math.min(index - 1, next.length - 1); i >= 0; i--) {
          const cand = next[i];
          if (cand && cand.parentId == null && !cand.completed) {
            newParentId = cand.id;
            break;
          }
        }
        // 2) nearest next active top-level
        if (newParentId == null) {
          for (let i = Math.max(0, index); i < next.length; i++) {
            const cand = next[i];
            if (cand && cand.parentId == null && !cand.completed) {
              newParentId = cand.id;
              break;
            }
          }
        }
        // 3) nearest previous top-level regardless of completed
        if (newParentId == null) {
          for (let i = Math.min(index - 1, next.length - 1); i >= 0; i--) {
            const cand = next[i];
            if (cand && cand.parentId == null) {
              newParentId = cand.id;
              break;
            }
          }
        }
        // 4) nearest next top-level regardless of completed
        if (newParentId == null) {
          for (let i = Math.max(0, index); i < next.length; i++) {
            const cand = next[i];
            if (cand && cand.parentId == null) {
              newParentId = cand.id;
              break;
            }
          }
        }
        const updatedTodos =
          newParentId == null
            ? outdentChildren(removed.id, next)
            : reparentChildren(removed.id, newParentId, next);
        const updatedLists = state.lists.map((l) =>
          l.id === list.id
            ? { ...l, todos: updatedTodos, updatedAt: new Date().toISOString() }
            : l,
        );
        return {
          ...state,
          lists: sortListsByRecency(updatedLists),
        } as TodosState;
      }
      const updatedLists = state.lists.map((l) =>
        l.id === list.id
          ? { ...l, todos: next, updatedAt: new Date().toISOString() }
          : l,
      );
      return {
        ...state,
        lists: sortListsByRecency(updatedLists),
      } as TodosState;
    });
  },

  // Actions: Lists management (minimal; persistence remains in hooks)
  addList: () => {
    const id =
      // eslint-disable-next-line no-undef
      (globalThis.crypto?.randomUUID?.() as string | undefined) ||
      `list-${Date.now()}`;
    const now = new Date().toISOString();
    set((state) => {
      const idx = state.lists.length + 1;
      const name = `List ${idx}`;
      const newList: TodoList = {
        id,
        name,
        todos: [],
        createdAt: now,
        updatedAt: now,
      } as any;
      const updatedLists = sortListsByRecency([...state.lists, newList]);
      return {
        ...state,
        lists: updatedLists,
        selectedListId: id,
      } as TodosState;
    });
    return id;
  },

  deleteSelectedList: () => {
    set((state) => {
      const id = state.selectedListId;
      if (!id) return state;
      const remaining = sortListsByRecency(
        state.lists.filter((l) => l.id !== id),
      );
      const nextSelected = remaining[0]?.id ?? null;
      return {
        ...state,
        lists: remaining,
        selectedListId: nextSelected,
      } as TodosState;
    });
  },

  deleteList: async (id) => {
    try {
      await deleteListApi(id);
    } catch {
      // ignore errors; UI flows handle error messaging
    }
    set((state) => {
      const remaining = sortListsByRecency(
        state.lists.filter((l) => l.id !== id),
      );
      const nextSelected =
        state.selectedListId === id
          ? (remaining[0]?.id ?? null)
          : state.selectedListId;
      return {
        ...state,
        lists: remaining,
        selectedListId: nextSelected,
      } as TodosState;
    });
  },

  renameList: (id, name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    set((state) => {
      const list = state.lists.find((l) => l.id === id);
      if (!list || list.name === trimmedName) return state;
      const updatedLists = state.lists.map((l) =>
        l.id === id
          ? { ...l, name: trimmedName, updatedAt: new Date().toISOString() }
          : l,
      );
      return {
        ...state,
        lists: sortListsByRecency(updatedLists),
      } as TodosState;
    });
  },

  updateListMeta: (id, updates) => {
    set((state) => {
      const list = state.lists.find((l) => l.id === id);
      if (!list) return state;
      const nextName = updates.name != null ? updates.name.trim() : list.name;
      const updatedLists = state.lists.map((l) =>
        l.id === id
          ? {
              ...l,
              name: nextName,
              updatedAt: new Date().toISOString(),
            }
          : l,
      );
      return {
        ...state,
        lists: sortListsByRecency(updatedLists),
      } as TodosState;
    });
  },

  duplicateList: async (sourceListId, newListName) => {
    const state = get();
    const sourceList = state.lists.find((l) => l.id === sourceListId);
    if (!sourceList) return null;

    try {
      const result = await duplicateListApi(sourceListId, newListName);

      if (result.success && result.newListId) {
        const now = new Date().toISOString();
        const newList: TodoList = {
          id: result.newListId,
          name: newListName || `${sourceList.name} (Copy)`,
          todos: [], // Will be loaded by useTodosPersistence
          createdAt: now,
          updatedAt: now,
        };
        set((prev) => {
          const updatedLists = sortListsByRecency([...prev.lists, newList]);
          return {
            ...prev,
            lists: updatedLists,
            selectedListId: result.newListId,
          } as TodosState;
        });
        return result.newListId;
      }
      return null;
    } catch {
      return null;
    }
  },

  // Computed selectors
  getSelectedList: () => {
    const { lists, selectedListId } = get();
    return lists.find((l) => l.id === selectedListId);
  },

  getListById: (id) => {
    return get().lists.find((l) => l.id === id);
  },
}));

/**
 * Convenience hooks for common selections
 */
export const useSelectedList = () => {
  const lists = useTodosStore((state) => state.lists);
  const selectedListId = useTodosStore((state) => state.selectedListId);
  return lists.find((l) => l.id === selectedListId);
};

export const useSelectedTodos = (): EditorTodo[] => {
  const selectedList = useSelectedList();
  return selectedList?.todos ?? [];
};
