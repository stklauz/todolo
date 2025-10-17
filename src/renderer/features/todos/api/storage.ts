import type { EditorTodo, AppSettings } from '../types';
import { debugLogger } from '../../../utils/debug';

// v2 index file format
export type ListsIndexV2 = {
  version: 2;
  lists: Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  selectedListId?: string;
};

export type ListTodosV2 = { version: 2; todos: EditorTodo[] };

export async function loadListsIndex(): Promise<ListsIndexV2> {
  return debugLogger.measureAsync('storage.loadListsIndex', async () => {
    try {
      debugLogger.log('info', 'Loading lists index');
      const result = (await window.electron.ipcRenderer.invoke(
        'load-lists',
      )) as ListsIndexV2;
      if (
        result &&
        typeof result === 'object' &&
        (result as unknown as { version?: unknown }).version === 2 &&
        Array.isArray((result as unknown as { lists?: unknown }).lists)
      ) {
        // Minimal item-shape validation: require id/name/createdAt
        const rawLists = (result as unknown as { lists: unknown[] }).lists;
        const validLists = rawLists.filter(
          (
            l,
          ): l is {
            id: string;
            name: string;
            createdAt: string;
            updatedAt?: string;
          } => {
            return Boolean(
              l &&
                typeof l === 'object' &&
                typeof (l as { id?: unknown }).id === 'string' &&
                typeof (l as { name?: unknown }).name === 'string' &&
                typeof (l as { createdAt?: unknown }).createdAt === 'string',
            );
          },
        );
        if (validLists.length !== rawLists.length) {
          debugLogger.log(
            'warn',
            'Lists index contained invalid items; filtered',
            {
              original: rawLists.length,
              kept: validLists.length,
            },
          );
        }
        // Ensure selectedListId points to a valid list
        const validIds = new Set(validLists.map((l) => l.id));
        const selected = (result as unknown as { selectedListId?: unknown })
          .selectedListId;
        const selectedListId =
          typeof selected === 'string' && validIds.has(selected)
            ? selected
            : undefined;

        const sanitized: ListsIndexV2 = {
          version: 2 as const,
          lists: validLists,
          selectedListId,
        };
        debugLogger.log('info', 'Lists index loaded successfully', {
          listCount: sanitized.lists.length,
          selectedListId: sanitized.selectedListId,
        });
        return sanitized;
      }
      // Validation failed without throwing: log a warning for visibility
      debugLogger.log(
        'warn',
        'Malformed lists index payload received; using safe default',
        {
          receivedType: typeof result,
          version: (result as unknown as { version?: unknown })?.version,
          listsType: Array.isArray(
            (result as unknown as { lists?: unknown })?.lists,
          )
            ? 'array'
            : typeof (result as unknown as { lists?: unknown })?.lists,
        },
      );
    } catch (error) {
      debugLogger.log('error', 'Failed to load lists index', error);
    }
    return { version: 2, lists: [], selectedListId: undefined };
  });
}

export async function saveListsIndex(doc: ListsIndexV2): Promise<boolean> {
  return debugLogger.measureAsync('storage.saveListsIndex', async () => {
    try {
      debugLogger.log('info', 'Saving lists index', {
        listCount: doc.lists.length,
        selectedListId: doc.selectedListId,
      });
      const res = (await window.electron.ipcRenderer.invoke(
        'save-lists',
        doc,
      )) as { success?: boolean; error?: string };
      const success = !!res?.success;
      debugLogger.log(success ? 'info' : 'error', 'Lists index save result', {
        success,
      });
      return success;
    } catch (error) {
      debugLogger.log('error', 'Failed to save lists index', error);
      return false;
    }
  });
}

export async function loadListTodos(listId: string): Promise<ListTodosV2> {
  return debugLogger.measureAsync('storage.loadListTodos', async () => {
    try {
      debugLogger.log('info', 'Loading list todos', { listId });
      const res = (await window.electron.ipcRenderer.invoke(
        'load-list-todos',
        listId,
      )) as ListTodosV2;
      if (
        res &&
        typeof res === 'object' &&
        (res as unknown as { version?: unknown }).version === 2 &&
        Array.isArray((res as unknown as { todos?: unknown }).todos)
      ) {
        debugLogger.log('info', 'List todos loaded successfully', {
          listId,
          todoCount: res.todos.length,
        });
        return res;
      }
      // Validation failed without throwing: log a warning for visibility
      debugLogger.log(
        'warn',
        'Malformed todos payload received; using safe default',
        {
          listId,
          version: (res as unknown as { version?: unknown })?.version,
          todosType: Array.isArray(
            (res as unknown as { todos?: unknown })?.todos,
          )
            ? 'array'
            : typeof (res as unknown as { todos?: unknown })?.todos,
        },
      );
    } catch (error) {
      debugLogger.log('error', 'Failed to load list todos', { listId, error });
    }
    return { version: 2, todos: [] };
  });
}

export async function saveListTodos(
  listId: string,
  doc: ListTodosV2,
): Promise<boolean> {
  return debugLogger.measureAsync('storage.saveListTodos', async () => {
    try {
      debugLogger.log('info', 'Saving list todos', {
        listId,
        todoCount: doc.todos.length,
      });
      const res = (await window.electron.ipcRenderer.invoke(
        'save-list-todos',
        listId,
        doc,
      )) as { success?: boolean; error?: string };
      const success = !!res?.success;
      debugLogger.log(success ? 'info' : 'error', 'List todos save result', {
        listId,
        success,
      });
      return success;
    } catch (error) {
      debugLogger.log('error', 'Failed to save list todos', { listId, error });
      return false;
    }
  });
}

export async function loadAppSettings(): Promise<AppSettings> {
  return debugLogger.measureAsync('storage.loadAppSettings', async () => {
    try {
      debugLogger.log('info', 'Loading app settings');
      const result = (await window.electron.ipcRenderer.invoke(
        'load-app-settings',
      )) as AppSettings;
      if (
        result &&
        typeof result === 'object' &&
        typeof result.hideCompletedItems === 'boolean'
      ) {
        debugLogger.log('info', 'App settings loaded successfully', result);
        return result;
      }
    } catch (error) {
      debugLogger.log('error', 'Failed to load app settings', error);
    }
    return { hideCompletedItems: true };
  });
}

export async function saveAppSettings(settings: AppSettings): Promise<boolean> {
  return debugLogger.measureAsync('storage.saveAppSettings', async () => {
    try {
      debugLogger.log('info', 'Saving app settings', settings);
      const res = (await window.electron.ipcRenderer.invoke(
        'save-app-settings',
        settings,
      )) as { success?: boolean; error?: string };
      const success = !!res?.success;
      debugLogger.log(success ? 'info' : 'error', 'App settings save result', {
        success,
      });
      return success;
    } catch (error) {
      debugLogger.log('error', 'Failed to save app settings', error);
      return false;
    }
  });
}

type DuplicateListResult =
  | { success: true; newListId: string }
  | {
      success: false;
      error: 'invalid_source_id' | 'not_found' | 'internal_error';
    };

export async function duplicateList(
  sourceListId: string,
  newListName?: string,
): Promise<DuplicateListResult> {
  return debugLogger.measureAsync('storage.duplicateList', async () => {
    try {
      debugLogger.log('info', 'Duplicating list', {
        sourceListId,
        newListName,
      });
      const result = (await window.electron.ipcRenderer.invoke(
        'duplicate-list',
        sourceListId,
        newListName,
      )) as DuplicateListResult;
      debugLogger.log(
        result.success ? 'info' : 'error',
        'Duplicate list result',
        result,
      );
      return result;
    } catch (e) {
      debugLogger.log('error', 'Error duplicating list', {
        sourceListId,
        error: e,
      });
      return { success: false, error: 'internal_error' };
    }
  });
}

export async function setSelectedListMeta(
  listId: string | null,
): Promise<void> {
  return debugLogger.measureAsync('storage.setSelectedListMeta', async () => {
    try {
      debugLogger.log('info', 'Setting selected list meta', { listId });
      await window.electron.ipcRenderer.invoke(
        'set-selected-list-meta',
        listId,
      );
    } catch (error) {
      debugLogger.log('error', 'Failed to set selected list meta', {
        listId,
        error,
      });
    }
  });
}

export async function deleteList(
  listId: string,
): Promise<{ success: boolean } | { success: false; error: string }> {
  return debugLogger.measureAsync('storage.deleteList', async () => {
    try {
      debugLogger.log('info', 'Deleting list', { listId });
      const res = (await window.electron.ipcRenderer.invoke(
        'delete-list',
        listId,
      )) as { success: boolean; error?: string };
      debugLogger.log(res.success ? 'info' : 'error', 'Delete list result', {
        listId,
        success: res.success,
        error: res.success ? undefined : res.error,
      });
      return res.success
        ? { success: true }
        : { success: false, error: res.error || 'unknown_error' };
    } catch (error) {
      debugLogger.log('error', 'Failed to delete list', { listId, error });
      return { success: false, error: 'internal_error' };
    }
  });
}
