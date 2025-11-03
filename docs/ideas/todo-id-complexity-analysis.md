# Todo ID Complexity Analysis

## Current State

### ID Structure

- Todo IDs are `number` type
- IDs are **unique within each list**, but **NOT globally unique** across all lists
- Each list can have todos with IDs: 1, 2, 3, etc.
- Global `idCounter` in the store increments sequentially, but IDs can be reused across lists

### Complexity Patterns Observed

**1. Linear Search Operations (O(n))**

- Found **62+ instances** of `.find()` and `.findIndex()` operations searching for todos by ID
- Common pattern: First find the list, then find the todo within that list:
  ```typescript
  const list = state.lists.find((l) => l.id === state.selectedListId);
  const idx = list.todos.findIndex((t) => t.id === id);
  ```

**2. Repeated Searches**

- Operations like `updateTodo`, `toggleTodo`, `setIndent`, `changeIndent` all:
  1. Find the list (`.find()`)
  2. Find the todo index (`.findIndex()`)
  3. Potentially search again for related todos (parents/children)

**3. Examples from Codebase**

**useTodosStore.ts:**

- `updateTodo`: Finds list, then maps todos array
- `toggleTodo`: Finds list, finds todo index, then searches for children
- `setIndent`: Finds list, finds todo index, then searches backward for parent
- `changeIndent`: Finds list, finds todo, finds todo index again

**useTodosOperations.ts:**

- `isDescendantInList`: Uses `.find()` in a loop to walk parent chain
- `toggleTodo`: Multiple `.find()` operations for descendant checks
- `changeIndent`: Finds todo, then finds index separately

**todoUtils.ts:**

- `computeTodoSection`: Finds parent with `.find()`
- `computeSectionById`: Finds todo, then finds index again
- `isChildOf`: Finds source and target indices separately
- `computeParentForIndentChange`: Finds target index, then searches backward

## The Problem

### Performance Impact

- **O(n) lookups** for every todo operation
- **Multiple passes** through arrays for single operations
- **No caching** - each operation re-searches from scratch

### Code Complexity

- Repetitive patterns across the codebase
- Easy to introduce bugs (e.g., forgetting to check if todo exists)
- Harder to maintain and reason about

## Potential Solutions

### Option 1: Globally Unique IDs (UUIDs)

**Approach:**

- Change todo IDs from `number` to `string` (UUIDs)
- Use `crypto.randomUUID()` or similar
- Maintain a global Map for O(1) lookups

**Pros:**

- ✅ O(1) lookups with Map/Set
- ✅ Could simplify operations (no need to find list first)
- ✅ No ID collisions across lists
- ✅ Better for future features (cross-list references, sharing, etc.)

**Cons:**

- ❌ Requires database migration
- ❌ Breaking change - all existing code uses `number`
- ❌ Larger storage footprint (strings vs numbers)
- ❌ More complex ID generation
- ❌ Need to update all 62+ search operations

**Implementation Complexity:** HIGH

- Change type definition
- Update database schema
- Migrate existing data
- Update all find operations
- Update tests

### Option 2: Per-List ID Maps (Current Structure, Optimized)

**Approach:**

- Keep current structure (numbers, per-list scope)
- Add Map<number, EditorTodo> index per list
- Maintain index alongside todos array

**Pros:**

- ✅ O(1) lookups within list
- ✅ Minimal breaking changes
- ✅ No database migration needed
- ✅ Backward compatible

**Cons:**

- ❌ Still need to find list first
- ❌ Need to maintain index consistency
- ❌ Adds memory overhead

**Implementation Complexity:** MEDIUM

- Add index to store/list structure
- Update operations to maintain index
- Add utility functions for lookups

### Option 3: Global Todo Registry (Hybrid)

**Approach:**

- Keep number IDs, but make them globally unique
- Add global Map<number, { listId: string, todo: EditorTodo }>
- Or: Map<number, { listId: string, index: number }>

**Pros:**

- ✅ O(1) lookups
- ✅ Could find todo without knowing list
- ✅ Still use numbers (no migration)

**Cons:**

- ❌ More complex state management
- ❌ Need to keep registry in sync
- ❌ Potential for ID collisions if not careful

**Implementation Complexity:** MEDIUM-HIGH

### Option 4: Index-Based Lookups (Simplest)

**Approach:**

- Add helper functions that use Map indices
- Create lookup utilities that cache indices
- Keep current structure, just optimize lookups

**Pros:**

- ✅ Minimal changes
- ✅ Can be done incrementally
- ✅ No breaking changes

**Cons:**

- ❌ Still O(n) first time (but cached after)
- ❌ Need to invalidate cache on mutations

**Implementation Complexity:** LOW

## Recommendation

**Short-term (Low effort, high impact):**

1. **Option 4**: Add lookup utilities with caching
   - Create `findTodoById(todos: EditorTodo[], id: number)` helper
   - Create `createTodoIndex(todos: EditorTodo[])` that returns Map
   - Use in hot paths

**Medium-term (Better architecture):** 2. **Option 2**: Add per-list ID maps

- Store `Map<number, EditorTodo>` alongside todos array
- Maintain index in store operations
- Update all operations to use index

**Long-term (If needed):** 3. **Option 1**: Globally unique UUIDs

- Only if we need cross-list features
- Requires careful migration planning

## Specific Complexity Examples

### Example 1: toggleTodo in useTodosStore.ts

```typescript
// Current: O(n) + O(n) + O(n) for descendants
const list = state.lists.find((l) => l.id === state.selectedListId); // O(n lists)
const idx = list.todos.findIndex((t) => t.id === id); // O(n todos)
// Then searches for children: O(n) for each child check
```

### Example 2: isDescendantInList in useTodosOperations.ts

```typescript
// Current: O(n) per iteration in loop
let current: EditorTodo | undefined = list.find((t) => t.id === candidateId);
while (current && current.parentId != null) {
  current = list.find((t) => t.id === (current as EditorTodo).parentId!);
}
// Worst case: O(n * depth) where depth can be up to n
```

### Example 3: computeParentForIndentChange in todoUtils.ts

```typescript
// Current: O(n) to find index, then O(n) to search backward
const targetIndex = todos.findIndex((t) => t.id === targetId); // O(n)
for (let i = targetIndex - 1; i >= 0; i--) {
  // O(n) worst case
  const candidate = todos[i];
  // ...
}
```

## Next Steps

1. **Measure**: Profile actual performance impact
2. **Start small**: Implement Option 4 (lookup utilities)
3. **Evaluate**: If still complex, consider Option 2
4. **Plan**: If globally unique needed, plan Option 1 migration
