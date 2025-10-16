import type { EditorTodo, Section } from '../types';
import { calculateEffectiveSection } from './todoUtils';

/**
 * Checks if targetId is a child of sourceId in the todos hierarchy
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

  // Must be in same section
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

/**
 * Computes the section for a todo in a given list (used in drag operations)
 */
export const computeSection = (list: EditorTodo[], id: number): Section => {
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return 'active';

  const cur = list[idx];
  const indent = Number(cur.indent ?? 0);

  if (indent <= 0) {
    if (!cur.completed) return 'active';
    for (let i = idx + 1; i < list.length; i++) {
      if (Number(list[i].indent ?? 0) === 0) break;
      if (!list[i].completed) return 'active';
    }
    return 'completed';
  }

  let parentCompleted = false;
  for (let i = idx - 1; i >= 0; i--) {
    if (Number(list[i].indent ?? 0) === 0) {
      parentCompleted = !!list[i].completed;
      break;
    }
  }
  return cur.completed && parentCompleted ? 'completed' : 'active';
};

/**
 * Extracts a block of todos starting from the given index
 * A block includes the parent and all its consecutive children
 */
export const extractTodoBlock = (
  todos: EditorTodo[],
  startIndex: number,
): { block: EditorTodo[]; endIndex: number } => {
  const block = [todos[startIndex]];
  let endIndex = startIndex;

  const srcIsParent = Number(todos[startIndex].indent ?? 0) === 0;

  if (srcIsParent) {
    // Include all consecutive children
    for (let i = startIndex + 1; i < todos.length; i++) {
      if (Number(todos[i].indent ?? 0) === 0) break;
      block.push(todos[i]);
      endIndex = i;
    }
  }

  return { block, endIndex };
};

/**
 * Inserts a block of todos at the specified index
 */
export const insertTodoBlock = (
  todos: EditorTodo[],
  block: EditorTodo[],
  insertIndex: number,
): EditorTodo[] => {
  const result = [...todos];
  result.splice(insertIndex, 0, ...block);
  return result;
};

/**
 * Removes a block of todos from the specified range
 */
export const removeTodoBlock = (
  todos: EditorTodo[],
  startIndex: number,
  endIndex: number,
): EditorTodo[] => {
  const result = [...todos];
  result.splice(startIndex, endIndex - startIndex + 1);
  return result;
};

/**
 * Fixes orphaned children by outdenting them if they have no parent
 */
export const fixOrphanedChildren = (
  todos: EditorTodo[],
  movedIndex: number,
): EditorTodo[] => {
  const result = [...todos];
  const movedTodo = result[movedIndex];

  if (movedTodo && Number(movedTodo.indent ?? 0) === 1) {
    let hasParent = false;
    for (let i = movedIndex - 1; i >= 0; i--) {
      if (Number(result[i].indent ?? 0) === 0) {
        hasParent = true;
        break;
      }
    }

    if (!hasParent) {
      result[movedIndex] = { ...movedTodo, indent: 0 };
    }
  }

  return result;
};

/**
 * Finds the last index in the specified section
 */
export const findLastIndexInSection = (
  todos: EditorTodo[],
  section: Section,
): number => {
  for (let i = todos.length - 1; i >= 0; i--) {
    if (computeSection(todos, todos[i].id) === section) {
      return i;
    }
  }
  return -1;
};

/**
 * Validates if a drag operation is allowed
 */
export const validateDragOperation = (
  sourceId: number,
  targetId: number,
  todos: EditorTodo[],
): { valid: boolean; reason?: string } => {
  if (sourceId === targetId) {
    return { valid: false, reason: 'Cannot drop on self' };
  }

  const sourceSection = calculateEffectiveSection(sourceId, todos);
  const targetSection = calculateEffectiveSection(targetId, todos);

  if (sourceSection !== targetSection) {
    return { valid: false, reason: 'Cannot drop across sections' };
  }

  if (isChildOf(sourceId, targetId, todos)) {
    return { valid: false, reason: 'Cannot drop parent under child' };
  }

  return { valid: true };
};
