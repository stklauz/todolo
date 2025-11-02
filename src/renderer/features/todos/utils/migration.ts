import type { EditorTodo } from '../types';

export type MigrationStats = {
  inferredParentIds: number;
  reparentedDueToInvariant: number;
};

/**
 * Infers parentId for each todo by scanning previous items and using indent.
 * Rule: parent is the nearest previous todo with indent strictly less than current.
 */
export function inferParentIds(todos: EditorTodo[]): EditorTodo[] {
  const result: EditorTodo[] = [];
  for (let i = 0; i < todos.length; i++) {
    const cur = todos[i];
    const curIndent = Number(cur.indent ?? 0);
    if (curIndent <= 0) {
      result.push({ ...cur, parentId: null });
    } else {
      let parentId: number | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const prev = todos[j];
        const prevIndent = Number(prev.indent ?? 0);
        if (prevIndent < curIndent) {
          parentId = prev.id;
          break;
        }
      }
      result.push({ ...cur, parentId });
    }
  }
  return result;
}

/**
 * Enforces: active children cannot have completed parents.
 * If violation found, reparent child to nearest previous active parent, else null.
 */
export function enforceParentChildInvariant(todos: EditorTodo[]): {
  todos: EditorTodo[];
  stats: MigrationStats;
} {
  const withParents = inferParentIds(todos);
  let reparented = 0;

  // Build quick lookup by id -> index for section computation reuse
  const idToIndex = new Map<number, number>();
  withParents.forEach((t, idx) => idToIndex.set(t.id, idx));

  const result: EditorTodo[] = withParents.map((t) => ({ ...t }));

  for (let i = 0; i < result.length; i++) {
    const cur = result[i];
    // Use RAW completion flags for the invariant, not effective section.
    const isChildActiveRaw = !cur.completed;
    if (cur.parentId != null) {
      const parentIdx = idToIndex.get(cur.parentId);
      if (parentIdx == null) {
        // Parent not found, detach
        result[i] = { ...cur, parentId: null };
        reparented++;
      } else {
        const parent = result[parentIdx];
        const isParentCompletedRaw = !!parent.completed;

        if (isChildActiveRaw && isParentCompletedRaw) {
          // Find nearest previous ACTIVE (raw) parent candidate
          let newParent: number | null = null;
          const curIndent = Number(cur.indent ?? 0);
          for (let k = i - 1; k >= 0; k--) {
            const candidate = result[k];
            const cIndent = Number(candidate.indent ?? 0);
            if (cIndent < curIndent) {
              if (!candidate.completed) {
                newParent = candidate.id;
                break;
              }
            }
          }
          result[i] = { ...cur, parentId: newParent };
          reparented++;
        }
      }
    }
  }

  return {
    todos: result,
    stats: {
      inferredParentIds: withParents.filter((t) => t.parentId !== null).length,
      reparentedDueToInvariant: reparented,
    },
  };
}

/**
 * One-shot migration applied on load: infer parentId and enforce invariant.
 * Only runs migration if parentId is not already present in todos (legacy data).
 *
 * Note: All todos from database already have parentId defined (null or number),
 * so migration only applies to legacy v2 storage data where parentId is undefined.
 * Partial migrations (mix of defined/undefined) are not possible in practice.
 */
export function runTodosMigration(todos: EditorTodo[]): {
  todos: EditorTodo[];
  stats: MigrationStats;
} {
  const hasParentIdProperty = todos.some((t) => t.parentId !== undefined);
  const hasIndentedWithoutParent = todos.some((t) => {
    const indent = Number(t.indent ?? 0);
    if (indent <= 0) return false;
    return t.parentId === undefined || t.parentId === null;
  });

  // Run migration whenever parentId field is missing entirely (legacy JSON data)
  // or when indented rows lack a parentId (legacy DB rows pre-migration).
  if (!hasParentIdProperty || hasIndentedWithoutParent) {
    return enforceParentChildInvariant(todos);
  }

  return {
    todos,
    stats: {
      inferredParentIds: 0,
      reparentedDueToInvariant: 0,
    },
  };
}
