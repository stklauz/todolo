import React from 'react';
import {
  saveListsIndex,
  duplicateList as duplicateListApi,
  deleteList as deleteListApi,
  setSelectedListMeta,
} from '../api/storage';
import type { TodoList } from '../types';
import { debugLogger } from '../../../utils/debug';

type UseListsManagementProps = {
  lists: TodoList[];
  setLists: React.Dispatch<React.SetStateAction<TodoList[]>>;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  listsRef: React.MutableRefObject<TodoList[]>;
  loadedListsRef: React.MutableRefObject<Set<string>>;
  saveWithStrategy: (type: 'immediate' | 'debounced', delay?: number) => void;
  flushCurrentTodos: () => Promise<boolean>;
};

export default function useListsManagement({
  lists,
  setLists,
  selectedListId,
  setSelectedListId,
  listsRef,
  loadedListsRef,
  saveWithStrategy,
  flushCurrentTodos,
}: UseListsManagementProps) {
  const serializeLists = React.useCallback((listsToSerialize: TodoList[]) => {
    const serialized: Array<{
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    }> = [];

    for (const list of listsToSerialize) {
      const parsedCreated = Date.parse(list.createdAt);
      const parsedUpdated = Date.parse(list.updatedAt);

      if (Number.isFinite(parsedCreated) && Number.isFinite(parsedUpdated)) {
        serialized.push({
          id: list.id,
          name: list.name,
          createdAt: new Date(parsedCreated).toISOString(),
          updatedAt: new Date(parsedUpdated).toISOString(),
        });
      } else {
        debugLogger.log(
          'warn',
          'Skipping list with invalid timestamps when serializing',
          {
            id: list.id,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
          },
        );
      }
    }

    return serialized;
  }, []);

  function addList(): string {
    // eslint-disable-next-line no-undef
    const id = globalThis.crypto?.randomUUID?.() || `list-${Date.now()}`;
    const idx = lists.length + 1;
    const name = `List ${idx}`;
    const now = new Date().toISOString();
    const newList = { id, name, todos: [], createdAt: now, updatedAt: now };
    // Rely on store's setLists to handle sorting to avoid double work
    setLists((prev) => [...prev, newList]);
    setSelectedListId(id);
    // Persist new list immediately to avoid FK/selection races on restart
    try {
      const snapshot = [...listsRef.current, newList];
      const indexDoc = {
        version: 2 as const,
        lists: serializeLists(snapshot),
        selectedListId: id,
      };
      saveListsIndex(indexDoc).catch(() => {});
    } catch {}
    return id;
  }

  function deleteSelectedList() {
    if (!selectedListId) return;
    // Fire-and-forget persistent delete in DB
    deleteListApi(selectedListId).catch((error) => {
      debugLogger.log('error', 'DB deleteSelectedList failed', {
        selectedListId,
        error,
      });
    });
    debugLogger.log('info', 'deleteSelectedList called', {
      selectedListId,
      listCountBefore: listsRef.current.length,
    });
    setLists((prev) => {
      const remaining = prev.filter((l) => l.id !== selectedListId);
      const nextSelected = remaining[0]?.id ?? null;
      setSelectedListId(nextSelected);
      // Persist deletion immediately to avoid reappearing lists after other operations
      try {
        const indexDoc = {
          version: 2 as const,
          lists: serializeLists(remaining),
          selectedListId: nextSelected ?? undefined,
        };
        saveListsIndex(indexDoc)
          .then((ok) => {
            debugLogger.log(
              ok ? 'info' : 'error',
              'Persisted index after deleteSelectedList',
              {
                success: ok,
                listCountAfter: indexDoc.lists.length,
                nextSelected,
              },
            );
          })
          .catch((error) => {
            debugLogger.log(
              'error',
              'Failed to persist index after deleteSelectedList',
              error,
            );
          });
      } catch {}
      return remaining;
    });
    // Remove from cache when deleted
    loadedListsRef.current.delete(selectedListId);
  }

  function deleteList(id: string) {
    // Prevent deleting the only list
    if (listsRef.current.length <= 1) {
      debugLogger.log('info', 'Prevented deletion of only list', {
        id,
        listCount: listsRef.current.length,
      });
      return;
    }

    // Fire-and-forget persistent delete in DB
    deleteListApi(id).catch((error) => {
      debugLogger.log('error', 'DB deleteList failed', { id, error });
    });
    debugLogger.log('info', 'deleteList called', {
      id,
      listCountBefore: listsRef.current.length,
    });
    setLists((prev) => {
      const remaining = prev.filter((l) => l.id !== id);
      // if we deleted the selected list, update selection
      const nextSelected =
        selectedListId === id ? (remaining[0]?.id ?? null) : selectedListId;
      setSelectedListId(nextSelected);
      // Persist deletion immediately to avoid reappearing lists after other operations
      try {
        const indexDoc = {
          version: 2 as const,
          lists: serializeLists(remaining),
          selectedListId: nextSelected ?? undefined,
        };
        saveListsIndex(indexDoc)
          .then((ok) => {
            debugLogger.log(
              ok ? 'info' : 'error',
              'Persisted index after deleteList',
              {
                success: ok,
                deletedId: id,
                listCountAfter: indexDoc.lists.length,
                nextSelected,
              },
            );
          })
          .catch((error) => {
            debugLogger.log(
              'error',
              'Failed to persist index after deleteList',
              error,
            );
          });
      } catch {}
      return remaining;
    });
    // Remove from cache when deleted
    loadedListsRef.current.delete(id);
  }

  // Custom setSelectedListId that triggers immediate save
  const setSelectedListIdWithSave = React.useCallback(
    (id: string | null) => {
      setSelectedListId(id);
      // List switching should be immediate
      saveWithStrategy('immediate');
      // Persist selection in index immediately to keep it across restarts
      try {
        const snapshot = listsRef.current;
        if (snapshot && snapshot.length > 0) {
          const indexDoc = {
            version: 2 as const,
            lists: serializeLists(snapshot),
            selectedListId: id ?? undefined,
          };
          saveListsIndex(indexDoc).catch(() => {});
        }
      } catch {}
    },
    [saveWithStrategy, setSelectedListId, listsRef, serializeLists],
  );

  function duplicateList(
    sourceListId: string,
    newListName?: string,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      // Ensure any pending saves for the source list are completed deterministically
      // to prevent race conditions where recent changes haven't been saved yet
      const sourceList = lists.find((l) => l.id === sourceListId);
      const proceed = async () => {
        try {
          const result = await duplicateListApi(sourceListId, newListName);

          if (result.success && result.newListId) {
            // Instead of reloading all lists from storage, just add the new list to current state
            // This prevents deleted lists from reappearing
            if (sourceList) {
              // Create the new list entry WITHOUT loading todos
              // Let useTodosPersistence handle loading via its effect
              const newList = {
                id: result.newListId,
                name: newListName || `${sourceList.name} (Copy)`,
                todos: [], // Empty - will be loaded by persistence hook
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setLists((prev) => [...prev, newList]);
              // DON'T mark as loaded - let persistence hook do it
              // Persist selection via index and meta for redundancy
              setSelectedListIdWithSave(result.newListId);
              setSelectedListMeta(result.newListId).catch(() => {});
              resolve(result.newListId);
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };

      // If duplicating the selected and loaded list, flush before proceeding
      const needsFlush =
        !!sourceList &&
        selectedListId === sourceListId &&
        loadedListsRef.current.has(sourceListId);
      if (needsFlush) {
        flushCurrentTodos().finally(proceed);
      } else {
        proceed();
      }
    });
  }

  return {
    addList,
    deleteSelectedList,
    deleteList,
    duplicateList,
    setSelectedListIdWithSave,
  } as const;
}
