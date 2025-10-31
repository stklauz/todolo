import type { EditorTodo, Section } from '../types';
import { MIN_INDENT, MAX_INDENT } from './constants';

/**
 * Clamps indent value to valid range
 */
export const clampIndent = (indent: number): number =>
  Math.max(MIN_INDENT, Math.min(MAX_INDENT, indent));

/**
 * Derives display indent from parentId relationship.
 * This ensures indent is a display-only concern, not source of truth.
 * Current model: 0 = top-level (parentId === null || parentId === undefined), 1 = child (parentId !== null && parentId !== undefined)
 */
export const deriveIndentFromParentId = (todo: EditorTodo): number => {
  // If parentId is explicitly null, it's top-level (display indent 0)
  if (todo.parentId === null) return 0;
  // If parentId is a number, it's a child (display indent 1)
  if (typeof todo.parentId === 'number') return 1;
  // Legacy case: parentId is undefined, fall back to stored indent
  const legacy = Number(todo.indent ?? 0);
  return legacy > 0 ? 1 : 0;
};

/**
 * Validates if todo text is not empty
 */
export const validateTodoText = (text: string): boolean =>
  text.trim().length > 0;

/**
 * Computes the effective section (active/completed) for a todo based on its completion status
 * and the completion status of its children (for parents) or parent (for children).
 * Uses parentId relationships instead of indent scanning.
 */
export const computeTodoSection = (
  todo: EditorTodo,
  todos: EditorTodo[],
  _index: number,
): Section => {
  // Top-level todo (parentId === null): check if it and all its children are completed
  if (todo.parentId == null) {
    // Find all immediate children by parentId
    const children = todos.filter((t) => t.parentId === todo.id);
    const allChildrenCompleted = children.every((child) => child.completed);
    return todo.completed && allChildrenCompleted ? 'completed' : 'active';
  }

  // Child todo: completed only if both child and parent are completed
  const parent = todos.find((t) => t.id === todo.parentId);
  const parentCompleted = parent ? !!parent.completed : false;
  return todo.completed && parentCompleted ? 'completed' : 'active';
};

/**
 * Computes indeterminate state for todos (when parent has some but not all children completed).
 * Uses parentId relationships instead of indent scanning.
 */
export const computeIndeterminateState = (
  todos: EditorTodo[],
): Map<number, boolean> => {
  const indeterminate = new Map<number, boolean>();

  for (const todo of todos) {
    // Only top-level todos (parents) can be indeterminate
    if (todo.parentId == null) {
      // Find all immediate children by parentId
      const children = todos.filter((t) => t.parentId === todo.id);
      const hasChild = children.length > 0;
      const anyChildCompleted = children.some((child) => child.completed);
      const allChildrenCompleted = children.every((child) => child.completed);

      indeterminate.set(
        todo.id,
        hasChild && anyChildCompleted && !allChildrenCompleted,
      );
    } else {
      // Child: never indeterminate
      indeterminate.set(todo.id, false);
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
  parentId: null,
  section: 'active',
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
 * Computes the section for a todo by ID in the todos array (used in drag/drop).
 * Uses parentId relationships instead of indent scanning.
 */
export const computeSectionById = (
  id: number,
  todos: EditorTodo[],
): Section => {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return 'active';

  // Delegate to computeTodoSection which uses parentId
  const idx = todos.findIndex((t) => t.id === id);
  return computeTodoSection(todo, todos, idx);
};

/**
 * Checks if targetId is a descendant of sourceId in the todos array.
 * Uses parentId relationships instead of indent scanning.
 * Used for drag/drop validation.
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

  // Target must come after source in array order
  if (targetIndex <= sourceIndex) return false;

  // Walk up the parentId chain from target to see if sourceId is an ancestor
  let currentId: number | null | undefined = targetTodo.parentId;
  const guard = new Set<number>();
  const idToTodo = new Map<number, EditorTodo>();
  todos.forEach((t) => {
    if (t.id != null) idToTodo.set(t.id, t);
  });
  while (currentId != null) {
    if (guard.has(currentId)) break; // Safety against cycles
    guard.add(currentId);
    if (currentId === sourceId) {
      return true;
    }
    const parent = idToTodo.get(currentId);
    currentId = parent?.parentId;
  }

  // Fallback for legacy/visual-only indentation:
  // Treat a consecutive deeper-indented block after the source as its visual children.
  const sourceIndent = Number(sourceTodo.indent ?? 0);
  const targetIndent = Number(targetTodo.indent ?? 0);
  if (targetIndent <= sourceIndent) return false;

  // Ensure target lies within the immediate visual block of the source
  for (let i = sourceIndex + 1; i <= targetIndex; i++) {
    const t = todos[i];
    if (!t) return false;
    const ind = Number(t.indent ?? 0);
    if (ind <= sourceIndent) {
      // We reached a sibling/parent boundary before target
      return false;
    }
  }
  return true;
};

/**
 * Returns whether a child with given section can attach to a parent with given section.
 * Cross-section parenting is forbidden.
 */
export const canAttachChild = (
  parentSection: Section,
  childSection: Section,
): boolean => parentSection === childSection;

/**
 * Reparents all immediate children of a parent to a new parent.
 * - Only updates todos whose parentId === parentId
 * - Preserves subtree relationships of those children
 */
export const reparentChildren = (
  parentId: number,
  newParentId: number | null,
  todos: EditorTodo[],
): EditorTodo[] => {
  const next = todos.map((t) =>
    t.parentId === parentId
      ? {
          ...t,
          parentId: newParentId,
          indent: deriveIndentFromParentId({
            ...t,
            parentId: newParentId,
          }),
        }
      : t,
  );
  return next;
};

/**
 * Outdents all immediate children of a parent to top-level.
 * - Sets parentId to null
 * - Sets indent to 0 (display-only)
 */
export const outdentChildren = (
  parentId: number,
  todos: EditorTodo[],
): EditorTodo[] => {
  const next = todos.map((t) =>
    t.parentId === parentId ? { ...t, parentId: null, indent: 0 } : t,
  );
  return next;
};
