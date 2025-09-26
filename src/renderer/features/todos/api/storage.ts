import type { AppData, TodoList, EditorTodo } from '../types';
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

// Storage batching to reduce IPC overhead
class StorageBatcher {
  private pendingSaves = new Map<string, { doc: ListTodosV2; resolve: (success: boolean) => void }>();
  private saveTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms batching window

  async saveListTodos(listId: string, doc: ListTodosV2): Promise<boolean> {
    return new Promise((resolve) => {
      // Cancel existing timeout if we have one
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }

      // Store the pending save
      this.pendingSaves.set(listId, { doc, resolve });

      // Set a new timeout to batch saves
      this.saveTimeout = setTimeout(() => {
        this.flushPendingSaves();
      }, this.BATCH_DELAY);
    });
  }

  private async flushPendingSaves() {
    if (this.pendingSaves.size === 0) return;

    const saves = Array.from(this.pendingSaves.entries());
    this.pendingSaves.clear();
    this.saveTimeout = null;

    // Process all saves in parallel
    const savePromises = saves.map(async ([listId, { doc, resolve }]) => {
      try {
        debugLogger.log('info', 'Saving list todos (batched)', { 
          listId, 
          todoCount: doc.todos.length 
        });
        const res = (await window.electron.ipcRenderer.invoke('save-list-todos', listId, doc)) as any;
        const success = !!res?.success;
        debugLogger.log(success ? 'info' : 'error', 'List todos save result (batched)', { 
          listId, 
          success 
        });
        resolve(success);
      } catch (error) {
        debugLogger.log('error', 'Failed to save list todos (batched)', { listId, error });
        resolve(false);
      }
    });

    await Promise.all(savePromises);
  }
}

const storageBatcher = new StorageBatcher();

export async function saveListTodos(listId: string, doc: ListTodosV2): Promise<boolean> {
  return debugLogger.measureAsync('storage.saveListTodos', async () => {
    return storageBatcher.saveListTodos(listId, doc);
  });
}

// Immediate save for critical operations (e.g., app shutdown)
export async function saveListTodosImmediate(listId: string, doc: ListTodosV2): Promise<boolean> {
  return debugLogger.measureAsync('storage.saveListTodos', async () => {
    try {
      debugLogger.log('info', 'Saving list todos (immediate)', { 
        listId, 
        todoCount: doc.todos.length 
      });
      const res = (await window.electron.ipcRenderer.invoke('save-list-todos', listId, doc)) as any;
      const success = !!res?.success;
      debugLogger.log(success ? 'info' : 'error', 'List todos save result (immediate)', { 
        listId, 
        success 
      });
      return success;
    } catch (error) {
      debugLogger.log('error', 'Failed to save list todos (immediate)', { listId, error });
      return false;
    }
  });
}

