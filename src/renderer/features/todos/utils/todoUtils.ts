import type { EditorTodo, Section } from '../types';
import { MIN_INDENT, MAX_INDENT } from './constants';

/**
 * Clamps indent value to valid range
 */
export const clampIndent = (indent: number): number =>
  Math.max(MIN_INDENT, Math.min(MAX_INDENT, indent));

/**
 * Validates if todo text is not empty
 */
export const validateTodoText = (text: string): boolean =>
  text.trim().length > 0;

/**
 * Computes the effective section (active/completed) for a todo based on its completion status
 * and the completion status of its children (for parents) or parent (for children)
 */
export const computeTodoSection = (
  todo: EditorTodo,
  todos: EditorTodo[],
  index: number,
): Section => {
  const indent = Number(todo.indent ?? 0);

  if (indent <= 0) {
    // Parent: effective completion requires parent AND all children to be completed
    let allChildrenCompleted = true;
    for (let i = index + 1; i < todos.length; i++) {
      if (Number(todos[i].indent ?? 0) === 0) break;
      if (!todos[i].completed) {
        allChildrenCompleted = false;
        break;
      }
    }
    return todo.completed && allChildrenCompleted ? 'completed' : 'active';
  }
  // Child: completed only if child and parent are completed
  let parentCompleted = false;
  for (let i = index - 1; i >= 0; i--) {
    if (Number(todos[i].indent ?? 0) === 0) {
      parentCompleted = !!todos[i].completed;
      break;
    }
  }
  return todo.completed && parentCompleted ? 'completed' : 'active';
};

/**
 * Computes indeterminate state for todos (when parent has some but not all children completed)
 */
export const computeIndeterminateState = (
  todos: EditorTodo[],
): Map<number, boolean> => {
  const indeterminate = new Map<number, boolean>();

  for (let i = 0; i < todos.length; i++) {
    const t = todos[i];
    const indent = Number(t.indent ?? 0);

    if (indent <= 0) {
      // Parent: check if has children and some are completed but not all
      let hasChild = false;
      let allChildrenCompleted = true;
      let anyChildCompleted = false;

      for (let j = i + 1; j < todos.length; j++) {
        if (Number(todos[j].indent ?? 0) === 0) break;
        hasChild = true;
        if (todos[j].completed) anyChildCompleted = true;
        if (!todos[j].completed) allChildrenCompleted = false;
      }

      indeterminate.set(
        t.id,
        hasChild && anyChildCompleted && !allChildrenCompleted,
      );
    } else {
      // Child: never indeterminate
      indeterminate.set(t.id, false);
    }
  }

  return indeterminate;
};

/**
 * Calculates the effective section for a todo by ID in the todos array
 */
export const calculateEffectiveSection = (
  id: number,
  todos: EditorTodo[],
): Section => {
  const idx = todos.findIndex((x) => x.id === id);
  if (idx === -1) return 'active';

  return computeTodoSection(todos[idx], todos, idx);
};

/**
 * Groups todos into active and completed sections based on their effective completion status
 */
export const groupTodosBySection = (todos: EditorTodo[]) => {
  const indeterminate = computeIndeterminateState(todos);
  const section = new Map<number, 'active' | 'completed'>();

  for (let i = 0; i < todos.length; i++) {
    const t = todos[i];
    section.set(t.id, computeTodoSection(t, todos, i));
  }

  const active: EditorTodo[] = [];
  const completed: EditorTodo[] = [];

  todos.forEach((t) =>
    section.get(t.id) === 'completed' ? completed.push(t) : active.push(t),
  );

  return { indeterminate, section, active, completed } as const;
};

/**
 * Finds the index of a todo by its ID
 */
export const findTodoIndexById = (todos: EditorTodo[], id: number): number => {
  return todos.findIndex((t) => t.id === id);
};

/**
 * Creates a new todo with the next available ID
 */
export const createNewTodo = (
  text: string,
  id: number,
  indent: number = 0,
): EditorTodo => ({
  id,
  text,
  completed: false,
  indent: clampIndent(indent),
});

/**
 * Updates a todo's text, preserving other properties
 */
export const updateTodoText = (todo: EditorTodo, text: string): EditorTodo => ({
  ...todo,
  text,
});

/**
 * Toggles a todo's completion status
 */
export const toggleTodoCompletion = (todo: EditorTodo): EditorTodo => ({
  ...todo,
  completed: !todo.completed,
});

/**
 * Updates a todo's indent level
 */
export const updateTodoIndent = (
  todo: EditorTodo,
  indent: number,
): EditorTodo => ({
  ...todo,
  indent: clampIndent(indent),
});

/**
 * Computes the section for a todo by ID in the todos array (used in drag/drop)
 * This is a simplified version that matches the logic in useDragReorder
 */
export const computeSectionById = (
  id: number,
  todos: EditorTodo[],
): Section => {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return 'active';

  const cur = todos[idx];
  const indent = Number(cur.indent ?? 0);

  if (indent <= 0) {
    // Parent: effective completion requires parent AND all children to be completed
    let allChildrenCompleted = true;
    for (let i = idx + 1; i < todos.length; i++) {
      if (Number(todos[i].indent ?? 0) === 0) break;
      if (!todos[i].completed) {
        allChildrenCompleted = false;
        break;
      }
    }
    return cur.completed && allChildrenCompleted ? 'completed' : 'active';
  }

  // Child: completed only if child and parent are completed
  let parentCompleted = false;
  for (let i = idx - 1; i >= 0; i--) {
    if (Number(todos[i].indent ?? 0) === 0) {
      parentCompleted = !!todos[i].completed;
      break;
    }
  }
  return cur.completed && parentCompleted ? 'completed' : 'active';
};

/**
 * Checks if targetId is a child of sourceId in the todos array
 * Used for drag/drop validation
 */
export const isChildOf = (
  sourceId: number,
  targetId: number,
  todos: EditorTodo[],
): boolean => {
  const sourceIndex = todos.findIndex((t) => t.id === sourceId);
  const targetIndex = todos.findIndex((t) => t.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) return false;

  const sourceTodo = todos[sourceIndex];
  const targetTodo = todos[targetIndex];

  if (!sourceTodo || !targetTodo) return false;

  // Must be in same section (same completion status)
  if (sourceTodo.completed !== targetTodo.completed) return false;

  // Target must come after source
  if (targetIndex <= sourceIndex) return false;

  const sourceIndent = sourceTodo.indent ?? 0;
  const targetIndent = targetTodo.indent ?? 0;

  // Target must be indented more than source
  if (targetIndent <= sourceIndent) return false;

  // Check if there's any todo between source and target that breaks the relationship
  for (let i = sourceIndex + 1; i < targetIndex; i++) {
    const todo = todos[i];
    if (todo && (todo.indent ?? 0) <= sourceIndent) {
      return false;
    }
  }

  return true;
};
