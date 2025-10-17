import type { EditorTodo, TodoList } from '../types';

/**
 * Validates and normalizes a todo object from storage
 */
export const normalizeTodo = (todo: any, fallbackId?: number): EditorTodo => {
  const id = typeof todo.id === 'number' ? todo.id : (fallbackId ?? 1);
  const text =
    typeof todo.text === 'string' ? todo.text : String(todo.text ?? '');
  const completed = Boolean(todo.completed ?? todo.checked ?? false);
  const indent = Math.max(0, Math.min(1, Number(todo.indent ?? 0)));

  return {
    id,
    text,
    completed,
    indent,
  };
};

/**
 * Validates and normalizes a list object from storage
 */
export const normalizeList = (list: any, fallbackIndex?: number): TodoList => {
  const id =
    typeof list.id === 'string' ? list.id : String(Date.now() + Math.random());
  const name =
    typeof list.name === 'string'
      ? list.name
      : `List ${(fallbackIndex ?? 0) + 1}`;
  const todos = Array.isArray(list.todos) ? list.todos.map(normalizeTodo) : [];
  const createdAt =
    typeof list.createdAt === 'string'
      ? list.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof list.updatedAt === 'string' ? list.updatedAt : undefined;

  return {
    id,
    name,
    todos,
    createdAt,
    updatedAt,
  };
};

/**
 * Validates if a todo ID is valid
 */
export const isValidTodoId = (id: any): id is number => {
  return typeof id === 'number' && id > 0 && Number.isInteger(id);
};

/**
 * Validates if a list ID is valid
 */
export const isValidListId = (id: any): id is string => {
  return typeof id === 'string' && id.length > 0;
};

/**
 * Validates if todo text is not empty
 */
export const isValidTodoText = (text: string): boolean => {
  return text.trim().length > 0;
};

/**
 * Validates if list name is not empty
 */
export const isValidListName = (name: string): boolean => {
  return name.trim().length > 0;
};

/**
 * Creates a validation result type
 */
export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string };

/**
 * Validates and normalizes a todo with error handling
 */
export const validateAndNormalizeTodo = (
  todo: any,
  fallbackId?: number,
): ValidationResult<EditorTodo> => {
  try {
    if (!todo || typeof todo !== 'object') {
      return { valid: false, error: 'Todo must be an object' };
    }

    // Check if the original ID is valid before normalization
    if (fallbackId === undefined && !isValidTodoId(todo.id)) {
      return { valid: false, error: 'Invalid todo ID' };
    }

    const normalized = normalizeTodo(todo, fallbackId);

    if (!isValidTodoId(normalized.id)) {
      return { valid: false, error: 'Invalid todo ID' };
    }

    return { valid: true, data: normalized };
  } catch (error) {
    return { valid: false, error: `Failed to normalize todo: ${error}` };
  }
};

/**
 * Validates and normalizes a list with error handling
 */
export const validateAndNormalizeList = (
  list: any,
  fallbackIndex?: number,
): ValidationResult<TodoList> => {
  try {
    if (!list || typeof list !== 'object') {
      return { valid: false, error: 'List must be an object' };
    }

    const normalized = normalizeList(list, fallbackIndex);

    if (!isValidListId(normalized.id)) {
      return { valid: false, error: 'Invalid list ID' };
    }

    if (!isValidListName(normalized.name)) {
      return { valid: false, error: 'Invalid list name' };
    }

    return { valid: true, data: normalized };
  } catch (error) {
    return { valid: false, error: `Failed to normalize list: ${error}` };
  }
};
