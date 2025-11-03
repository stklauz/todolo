import React from 'react';
import { loadListsIndex, saveListsIndex } from '../api/storage';
import type { TodoList } from '../types';
import { debugLogger } from '../../../utils/debug';
import { normalizeList } from '../utils/validation';
import { SaveQueue } from '../utils/saveQueue';
import { useTodosStore } from '../store/useTodosStore';

/**
 * Phase 5 Refactor: Zero parameters! Store handles all state.
 * Before: 6 parameters (lists, setLists, selectedListId, setSelectedListId, listsRef, selectedListIdRef)
 * After: 0 parameters
 */
export default function useListsIndex() {
  // Read from store (no props!)
  const lists = useTodosStore((state) => state.lists);
  const selectedListId = useTodosStore((state) => state.selectedListId);
  const indexLoaded = useTodosStore((state) => state.indexLoaded);

  // Write to store (no setState props!)
  const setLists = useTodosStore((state) => state.setLists);
  const setSelectedListId = useTodosStore((state) => state.setSelectedListId);
  const setIndexLoaded = useTodosStore((state) => state.setIndexLoaded);

  const initialListCreatedRef = React.useRef(false);
  const listCreationInProgressRef = React.useRef(false);

  // Centralized save queue for lists index (same pattern as todos persistence)
  const queueRef = React.useRef<SaveQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new SaveQueue(async () => {
      try {
        // Read directly from store (no refs needed!)
        const snapshot = useTodosStore.getState().lists;
        const sel = useTodosStore.getState().selectedListId;
        if (!snapshot || snapshot.length === 0) return;
        const indexDoc = {
          version: 2 as const,
          lists: snapshot.map((l) => ({
            id: l.id,
            name: l.name,
            createdAt: l.createdAt!,
            updatedAt: l.updatedAt,
          })),
          selectedListId: sel ?? undefined,
        };
        await saveListsIndex(indexDoc);
      } catch (error) {
        debugLogger.log('error', 'Queue-triggered save of lists index failed', {
          error,
        });
      }
    });
  }

  // Load lists (index) on mount
  React.useEffect(() => {
    const load = async () => {
      try {
        const index = await loadListsIndex();

        const normalizedLists: TodoList[] = (index.lists || []).map(
          (list, li) => normalizeList(list, li),
        );
        setLists(normalizedLists);
        setSelectedListId(
          index.selectedListId &&
            normalizedLists.some((l) => l.id === index.selectedListId)
            ? index.selectedListId!
            : (normalizedLists[0]?.id ?? null),
        );
      } catch (error) {
        debugLogger.log('error', 'Failed to load lists index', { error });
      } finally {
        setIndexLoaded(true);
      }
    };
    load();
  }, [setLists, setSelectedListId, setIndexLoaded]);

  // Ensure at least one list exists (guard against StrictMode double-invoke)
  React.useEffect(() => {
    // Only create a list after the index load completes
    if (!indexLoaded) return;
    // Only create a list if we have NO lists AND haven't already created one AND not currently creating one
    if (
      lists.length === 0 &&
      !initialListCreatedRef.current &&
      !listCreationInProgressRef.current
    ) {
      initialListCreatedRef.current = true;
      listCreationInProgressRef.current = true;
      const id = crypto?.randomUUID?.() || String(Date.now());
      const newList = {
        id,
        name: 'My Todos',
        todos: [],
        createdAt: new Date().toISOString(),
      } as TodoList;
      setLists([newList]);
      setSelectedListId(id);
      // Save immediately to ensure persistence
      const indexDoc = {
        version: 2 as const,
        lists: [
          {
            id: newList.id,
            name: newList.name,
            createdAt: newList.createdAt!,
            updatedAt: newList.updatedAt,
          },
        ],
        selectedListId: id,
      };
      saveListsIndex(indexDoc)
        .then(() => {
          listCreationInProgressRef.current = false;
        })
        .catch((error) => {
          debugLogger.log('error', 'Failed to save initial list', error);
          listCreationInProgressRef.current = false;
        });
    } else if (!selectedListId && lists.length > 0) {
      setSelectedListId(lists[0].id);
    } else {
    }
    // Intentionally omit queueRef, setLists, setSelectedListId - stable refs/callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexLoaded, lists.length]);

  // Debounced save of lists index (names/order/selection, not todos)
  // All saves now go through centralized SaveQueue
  React.useEffect(() => {
    queueRef.current?.enqueue('debounced', 800);
    // Intentionally omit queueRef - stable ref, queue reads fresh state via getState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, selectedListId]);

  // Ensure initial selection is persisted immediately after it is determined
  // so the same list opens after restart.
  React.useEffect(() => {
    if (!selectedListId || lists.length === 0) return;
    queueRef.current?.enqueue('immediate');
    // Intentionally omit queueRef - stable ref, queue reads fresh state via getState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId, lists]);

  // Flush lists index immediately on window close/blur/hidden, to avoid losing debounced changes
  // Unified lifecycle handling through SaveQueue (same pattern as todos persistence)
  React.useEffect(() => {
    const flushSaves = () => {
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
  }, []); // No deps - queueRef is stable, handlers use store internally
}
