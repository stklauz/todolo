import type { AppData, TodoList, EditorTodo, AppSettings } from '../types';
import { debugLogger } from '../../../utils/debug';

// v2 index file format
export type ListsIndexV2 = {
  version: 2;
  lists: Array<{ id: string; name: string; createdAt: string; updatedAt?: string }>;
  selectedListId?: string;
};

export type ListTodosV2 = { version: 2; todos: EditorTodo[] };

export async function loadListsIndex(): Promise<ListsIndexV2> {
  return debugLogger.measureAsync('storage.loadListsIndex', async () => {
    try {
      debugLogger.log('info', 'Loading lists index');
      const result = (await window.electron.ipcRenderer.invoke('load-lists')) as ListsIndexV2;
      if (
        result &&
        typeof result === 'object' &&
        (result as any).version === 2 &&
        Array.isArray((result as any).lists)
      ) {
        debugLogger.log('info', 'Lists index loaded successfully', { 
          listCount: result.lists.length,
          selectedListId: result.selectedListId 
        });
        return result;
      }
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
        selectedListId: doc.selectedListId 
      });
      const res = (await window.electron.ipcRenderer.invoke('save-lists', doc)) as any;
      const success = !!res?.success;
      debugLogger.log(success ? 'info' : 'error', 'Lists index save result', { success });
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
      const res = (await window.electron.ipcRenderer.invoke('load-list-todos', listId)) as ListTodosV2;
      if (res && typeof res === 'object' && Array.isArray((res as any).todos)) {
        debugLogger.log('info', 'List todos loaded successfully', { 
          listId, 
          todoCount: res.todos.length 
        });
        return res;
      }
    } catch (error) {
      debugLogger.log('error', 'Failed to load list todos', { listId, error });
    }
    return { version: 2, todos: [] };
  });
}

export async function saveListTodos(listId: string, doc: ListTodosV2): Promise<boolean> {
  return debugLogger.measureAsync('storage.saveListTodos', async () => {
    try {
      debugLogger.log('info', 'Saving list todos', { 
        listId, 
        todoCount: doc.todos.length 
      });
      const res = (await window.electron.ipcRenderer.invoke('save-list-todos', listId, doc)) as any;
      const success = !!res?.success;
      debugLogger.log(success ? 'info' : 'error', 'List todos save result', { 
        listId, 
        success 
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
      const result = (await window.electron.ipcRenderer.invoke('load-app-settings')) as AppSettings;
      if (result && typeof result === 'object' && typeof result.hideCompletedItems === 'boolean') {
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
      const res = (await window.electron.ipcRenderer.invoke('save-app-settings', settings)) as any;
      const success = !!res?.success;
      debugLogger.log(success ? 'info' : 'error', 'App settings save result', { success });
      return success;
    } catch (error) {
      debugLogger.log('error', 'Failed to save app settings', error);
      return false;
    }
  });
}

