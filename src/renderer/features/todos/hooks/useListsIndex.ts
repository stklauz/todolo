import React from 'react';
import { loadListsIndex, saveListsIndex } from '../api/storage';
import type { TodoList } from '../types';
import { debugLogger } from '../../../utils/debug';
import { normalizeList } from '../utils/validation';

type UseListsIndexProps = {
  lists: TodoList[];
  setLists: React.Dispatch<React.SetStateAction<TodoList[]>>;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  listsRef: React.MutableRefObject<TodoList[]>;
  selectedListIdRef: React.MutableRefObject<string | null>;
};

export default function useListsIndex({
  lists,
  setLists,
  selectedListId,
  setSelectedListId,
  listsRef,
  selectedListIdRef,
}: UseListsIndexProps) {
  const [indexLoaded, setIndexLoaded] = React.useState(false);
  const saveTimerRef = React.useRef<number | null>(null);
  const initialListCreatedRef = React.useRef(false);
  const listCreationInProgressRef = React.useRef(false);

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
      } catch {
      } finally {
        setIndexLoaded(true);
      }
    };
    load();
  }, [setLists, setSelectedListId]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexLoaded, lists.length]);

  // Debounced save of lists index (names/order/selection, not todos)
  React.useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        const indexDoc = {
          version: 2,
          lists: lists.map((l) => ({
            id: l.id,
            name: l.name,
            createdAt: l.createdAt!,
            updatedAt: l.updatedAt,
          })),
          selectedListId: selectedListId ?? undefined,
        } as const;

        saveListsIndex(indexDoc).catch((error) => {
          debugLogger.log('error', 'Failed to save lists index', error);
        });
      } catch {}
    }, 800);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [lists, selectedListId]);

  // Ensure initial selection is persisted immediately after it is determined
  // so the same list opens after restart.
  React.useEffect(() => {
    if (!selectedListId || lists.length === 0) return;
    try {
      const indexDoc = {
        version: 2 as const,
        lists: lists.map((l) => ({
          id: l.id,
          name: l.name,
          createdAt: l.createdAt!,
          updatedAt: l.updatedAt,
        })),
        selectedListId,
      };

      saveListsIndex(indexDoc).catch(() => {});
    } catch {}
  }, [selectedListId, lists]);

  // Flush lists index immediately on window close/blur/hidden, to avoid losing debounced changes
  React.useEffect(() => {
    const flushIndex = () => {
      try {
        const snapshot = listsRef.current;
        const sel = selectedListIdRef.current;
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
        saveListsIndex(indexDoc).catch((error) => {
          debugLogger.log('error', 'Failed to save lists index', error);
        });
      } catch {}
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushIndex();
    };
    window.addEventListener('beforeunload', flushIndex);
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', flushIndex);
    return () => {
      window.removeEventListener('beforeunload', flushIndex);
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', flushIndex);
    };
  }, [listsRef, selectedListIdRef]);

  return {
    indexLoaded,
  } as const;
}
