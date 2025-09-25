import type { AppData, TodoList, EditorTodo } from '../types';

// v2 index file format
export type ListsIndexV2 = {
  version: 2;
  lists: Array<{ id: string; name: string; createdAt: string; updatedAt?: string }>;
  selectedListId?: string;
};

export type ListTodosV2 = { version: 2; todos: EditorTodo[] };

export async function loadListsIndex(): Promise<ListsIndexV2> {
  try {
    const result = (await window.electron.ipcRenderer.invoke('load-lists')) as ListsIndexV2;
    if (
      result &&
      typeof result === 'object' &&
      (result as any).version === 2 &&
      Array.isArray((result as any).lists)
    ) {
      return result;
    }
  } catch {}
  return { version: 2, lists: [], selectedListId: undefined };
}

export async function saveListsIndex(doc: ListsIndexV2): Promise<boolean> {
  try {
    const res = (await window.electron.ipcRenderer.invoke('save-lists', doc)) as any;
    return !!res?.success;
  } catch {
    return false;
  }
}

export async function loadListTodos(listId: string): Promise<ListTodosV2> {
  try {
    const res = (await window.electron.ipcRenderer.invoke('load-list-todos', listId)) as ListTodosV2;
    if (res && typeof res === 'object' && Array.isArray((res as any).todos)) return res;
  } catch {}
  return { version: 2, todos: [] };
}

export async function saveListTodos(listId: string, doc: ListTodosV2): Promise<boolean> {
  try {
    const res = (await window.electron.ipcRenderer.invoke('save-list-todos', listId, doc)) as any;
    return !!res?.success;
  } catch {
    return false;
  }
}

