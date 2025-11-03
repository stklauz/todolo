import React from 'react';
import { useTodosStore } from '../store/useTodosStore';
import type { TodoList } from '../types';

/**
 * Test wrapper for Zustand store-based hooks.
 * Resets store state before each test and allows initialization.
 */
export function TestStoreWrapper({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

/**
 * Initialize store state for tests.
 */
export function initializeTestStore(initialState?: {
  lists?: TodoList[];
  selectedListId?: string | null;
  indexLoaded?: boolean;
  loadedLists?: Set<string>;
  idCounter?: number;
}) {
  const store = useTodosStore.getState();

  // Reset to clean state
  store.setLists(initialState?.lists || []);
  store.setSelectedListId(initialState?.selectedListId ?? null);
  store.setIndexLoaded(initialState?.indexLoaded ?? false);

  // Reset internal tracking
  if (initialState?.loadedLists) {
    initialState.loadedLists.forEach((id) => store.markListAsLoaded(id));
  }

  if (initialState?.idCounter !== undefined) {
    useTodosStore.setState({ idCounter: initialState.idCounter });
  }
}

/**
 * Reset store to clean state (call in beforeEach).
 */
export function resetTestStore() {
  useTodosStore.setState({
    lists: [],
    selectedListId: null,
    indexLoaded: false,
    loadedLists: new Set(),
    idCounter: 1,
  });
}
