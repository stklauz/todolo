import type { AppData, TodoList, EditorTodo } from '../types';

const DEFAULT_DATA = (): AppData => ({ version: 1, lists: [], selectedListId: undefined });

export async function loadAppData(): Promise<AppData> {
  try {
    const result = await window.electron.ipcRenderer.invoke('load-todos');
    // Back-compat: if result is an array, treat as single list
    if (Array.isArray(result)) {
      const listId = crypto?.randomUUID?.() || String(Date.now());
      return {
        version: 1,
        lists: [{ id: listId, name: 'My Todos', todos: result as EditorTodo[] }],
        selectedListId: listId,
      };
    }
    if (result && typeof result === 'object' && Array.isArray((result as any).lists)) {
      const data = result as AppData;
      return { version: 1, lists: data.lists, selectedListId: data.selectedListId };
    }
    return DEFAULT_DATA();
  } catch {
    return DEFAULT_DATA();
  }
}

export function saveAppData(data: AppData): void {
  try {
    window.electron.ipcRenderer.sendMessage('save-todos', data);
  } catch {
    // ignore
  }
}
