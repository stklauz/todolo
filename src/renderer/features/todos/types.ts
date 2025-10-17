import React from 'react';

export type EditorTodo = {
  id: number;
  text: string;
  completed: boolean;
  // indentation level: 0..1 (clamped)
  indent?: number;
};

export type TodoList = {
  id: string;
  name: string;
  todos: EditorTodo[];
  createdAt?: string;
  updatedAt?: string;
};

export type AppData = {
  version: 1;
  lists: TodoList[];
  selectedListId?: string;
};

export type AppSettings = {
  hideCompletedItems: boolean;
};

export type Section = 'active' | 'completed';

// Action types for potential reducer pattern
export type TodoAction =
  | { type: 'ADD_TODO'; payload: { text: string; indent: number } }
  | { type: 'UPDATE_TODO'; payload: { id: number; text: string } }
  | { type: 'TOGGLE_TODO'; payload: { id: number } }
  | { type: 'DELETE_TODO'; payload: { id: number } }
  | { type: 'CHANGE_INDENT'; payload: { id: number; delta: number } }
  | { type: 'SET_INDENT'; payload: { id: number; indent: number } };

export type ListAction =
  | { type: 'ADD_LIST'; payload: { name: string } }
  | { type: 'DELETE_LIST'; payload: { id: string } }
  | { type: 'DUPLICATE_LIST'; payload: { sourceId: string; newName?: string } }
  | { type: 'RENAME_LIST'; payload: { id: string; name: string } }
  | { type: 'SELECT_LIST'; payload: { id: string } };

// Validation result type
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

// Drag and drop types
export type DragInfo = {
  id: number;
  section: Section;
};

export type DropTarget = {
  id: number | null;
  section: Section | null;
};

// Storage types
export type StorageVersion = 1 | 2;

export type ListsIndexDoc = {
  version: StorageVersion;
  lists: Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  selectedListId?: string;
};

export type TodosDoc = {
  version: StorageVersion;
  todos: Array<{
    id: number;
    text: string;
    completed: boolean;
    indent?: number;
  }>;
};

// API response types
export type DuplicateListResult = {
  success: boolean;
  newListId?: string;
  error?: string;
};

// Hook return types
export type UseTodosStateReturn = {
  lists: TodoList[];
  setLists: React.Dispatch<React.SetStateAction<TodoList[]>>;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  getSelectedTodos: () => EditorTodo[];
  setSelectedTodos: (
    updater: (prev: EditorTodo[]) => EditorTodo[] | null | undefined,
  ) => void;
  updateTodo: (id: number, text: string) => void;
  toggleTodo: (id: number) => void;
  setIndent: (id: number, indent: number) => void;
  changeIndent: (id: number, delta: number) => void;
  insertTodoBelow: (index: number, text?: string) => number;
  removeTodoAt: (index: number) => void;
  addList: () => string;
  deleteSelectedList: () => void;
  deleteList: (id: string) => void;
  duplicateList: (
    sourceListId: string,
    newListName?: string,
  ) => Promise<string | null>;
  flushCurrentTodos: () => Promise<boolean>;
};
