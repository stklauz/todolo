import React from 'react';
import {
  saveListsIndex,
  duplicateList as duplicateListApi,
  deleteList as deleteListApi,
  loadListTodos,
  setSelectedListMeta,
} from '../api/storage';
import type { TodoList } from '../types';
import { debugLogger } from '../../../utils/debug';
import { normalizeTodo } from '../utils/validation';

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
  function addList(): string {
    const id = crypto?.randomUUID?.() || `list-${Date.now()}`;
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
        lists: snapshot.map((l) => ({
          id: l.id,
          name: l.name,
          createdAt: l.createdAt || new Date().toISOString(),
          updatedAt: l.updatedAt,
        })),
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
          lists: remaining.map((l) => ({
            id: l.id,
            name: l.name,
            createdAt: l.createdAt || new Date().toISOString(),
            updatedAt: l.updatedAt,
          })),
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
          lists: remaining.map((l) => ({
            id: l.id,
            name: l.name,
            createdAt: l.createdAt || new Date().toISOString(),
            updatedAt: l.updatedAt,
          })),
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
            lists: snapshot.map((l) => ({
              id: l.id,
              name: l.name,
              createdAt: l.createdAt || new Date().toISOString(),
              updatedAt: l.updatedAt,
            })),
            selectedListId: id ?? undefined,
          };
          saveListsIndex(indexDoc).catch(() => {});
        }
      } catch {}
    },
    [saveWithStrategy, setSelectedListId, listsRef],
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
              // Load the todos for the newly duplicated list to ensure completed items are mirrored
              try {
                const fetched = await loadListTodos(result.newListId);
                const todosNorm = (fetched.todos || []).map(
                  (t: unknown, i: number) => normalizeTodo(t, i + 1),
                );

                const newList = {
                  id: result.newListId,
                  name: newListName || `${sourceList.name} (Copy)`,
                  todos: todosNorm,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                setLists((prev) => [...prev, newList]);
                // Mark the list as loaded in cache to prevent unnecessary reloads
                loadedListsRef.current.add(result.newListId);
                // Persist selection via index and meta for redundancy
                setSelectedListIdWithSave(result.newListId);
                setSelectedListMeta(result.newListId).catch(() => {});
                // Selection and meta are persisted; no full index reload here to avoid
                // reintroducing deleted lists due to save timing.
                resolve(result.newListId);
              } catch {
                // console.error(
                //   'Failed to load todos for duplicated list:',
                //   error,
                // );
                // Fallback to empty todos if loading fails
                const newList = {
                  id: result.newListId,
                  name: newListName || `${sourceList.name} (Copy)`,
                  todos: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                setLists((prev) => [...prev, newList]);
                setSelectedListIdWithSave(result.newListId);
                setSelectedListMeta(result.newListId).catch(() => {});
                resolve(result.newListId);
              }
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
