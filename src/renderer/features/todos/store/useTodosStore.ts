import { create } from 'zustand';
import type { TodoList, EditorTodo } from '../types';
import { debugLogger } from '../../../utils/debug';

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
      const newLists =
        typeof listsOrFn === 'function' ? listsOrFn(state.lists) : listsOrFn;
      debugLogger.log('info', 'Store: setLists', {
        count: newLists.length,
      });
      return { lists: newLists };
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
