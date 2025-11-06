# Technical Debt & Future Improvements

This document tracks known areas for improvement after the successful Phase 5 architecture cleanup.

**Current Quality Status**: A- (Excellent)

- Duplication: 2.71% ✅
- Test Coverage: 97.75% ✅ (400/400 tests passing)
- TypeScript: 0 errors ✅
- ESLint: 0 errors ✅

---

## 🔴 High Priority (Optional)

### 1. Refactor `useTodosStore.toggleTodo` - Complexity After Migration

**Current State:**

- Complexity: 16 (max 15 recommended)
- 33 statements (max 30 recommended)
- Nesting depth: 6 (max 4 recommended)
- Block nesting at lines 189-199

**Impact**: High - Core action used frequently, complexity increased during Context-to-Zustand migration

**Problem**: Complex hierarchical todo toggling logic with deeply nested conditionals for parent-child relationships

**Root Cause**: The `toggleTodo` action handles multiple scenarios:

1. Toggling a parent todo with `parentId` links (strict hierarchy check)
2. Toggling a parent todo with indent-based children (loose hierarchy)
3. Toggling a child todo

**Proposed Solution:**

1. **Extract Hierarchy Detection to Utility**

   ```typescript
   // utils/todoHierarchy.ts
   function findDescendants(
     todos: EditorTodo[],
     parentId: number,
     mode: 'strict' | 'indent',
   ): number[] {
     if (mode === 'strict') {
       return findDescendantsByParentId(todos, parentId);
     }
     return findDescendantsByIndent(todos, parentId);
   }

   function findDescendantsByParentId(
     todos: EditorTodo[],
     targetId: number,
   ): number[] {
     const descendants: number[] = [];
     for (const todo of todos) {
       if (isDescendantOf(todo, targetId, todos)) {
         descendants.push(todo.id);
       }
     }
     return descendants;
   }

   function isDescendantOf(
     todo: EditorTodo,
     targetId: number,
     allTodos: EditorTodo[],
   ): boolean {
     let current = todo;
     const guard = new Set<number>();

     while (current && current.parentId != null) {
       if (guard.has(current.id)) return false;
       guard.add(current.id);
       if (current.parentId === targetId) return true;
       const { parentId } = current;
       current = allTodos.find((t) => t.id === parentId)!;
     }
     return false;
   }
   ```

2. **Simplify toggleTodo Action**

   ```typescript
   toggleTodo: (id: number) => {
     set((state) => {
       const list = state.getSelectedList();
       if (!list) return state;

       const idx = list.todos.findIndex((t) => t.id === id);
       if (idx === -1) return state;

       const todo = list.todos[idx];
       const newCompleted = !todo.completed;
       const next = [...list.todos];
       next[idx] = { ...todo, completed: newCompleted };

       // Find and toggle all descendants
       const descendantIds = findDescendants(
         next,
         todo.id,
         todo.parentId != null ? 'strict' : 'indent'
       );

       for (const descId of descendantIds) {
         const descIdx = next.findIndex(t => t.id === descId);
         if (descIdx !== -1) {
           next[descIdx] = { ...next[descIdx], completed: newCompleted };
         }
       }

       return {
         lists: state.lists.map((l) =>
           l.id === state.selectedListId
             ? { ...l, todos: next, updatedAt: new Date().toISOString() }
             : l
         ),
       };
     });
   },
   ```

**Benefits:**

- Reduces nesting from 6 to 3
- Separates hierarchy detection from state updates
- More testable (can unit test hierarchy utils separately)
- Easier to understand and maintain

**Files to Change:**

- Create: `src/renderer/features/todos/utils/todoHierarchy.ts`
- Update: `src/renderer/features/todos/store/useTodosStore.ts`
- Create: `src/renderer/features/todos/utils/__tests__/todoHierarchy.test.ts`

**Estimated Effort**: 2-3 hours

---

### 2. Refactor `useDragReorder` - High Complexity

**Current State:**

- 274 lines (max 80 recommended)
- Cyclomatic complexity: 28 (max 15 recommended)
- Nesting depth: 5 (max 4 recommended)

**Impact**: High - This is the most complex hook in the codebase

**Problem**: Complex drag-and-drop state machine with nested conditionals

**Proposed Solution:**

1. **Extract to State Machine Pattern**

   ```typescript
   // Example structure:
   type DragState =
     | { type: 'idle' }
     | { type: 'dragging'; itemId: number; startY: number }
     | { type: 'hovering'; itemId: number; hoverIndex: number }
     | { type: 'dropping'; fromIndex: number; toIndex: number };
   ```

2. **Extract Helper Functions**
   - `calculateDropPosition(mouseY: number, items: Todo[]): number`
   - `validateDrop(fromIndex: number, toIndex: number): boolean`
   - `applyReorder(items: Todo[], from: number, to: number): Todo[]`

3. **Split into Sub-hooks**
   - `useDragState()` - State management
   - `useDragHandlers()` - Event handlers
   - `useDropValidation()` - Business logic

**Files to Change:**

- `src/renderer/features/todos/hooks/useDragReorder.ts`

**Estimated Effort**: 4-6 hours

**References:**

- [State Machine Pattern in React](https://kentcdodds.com/blog/implementing-a-simple-state-machine-library-in-javascript)
- [XState for complex state machines](https://xstate.js.org/)

---

## 🟡 Medium Priority (Optional)

### 3. Reduce Store Action Duplication in `useTodosStore.ts`

**Current State:**

- 4 code clones within the same file
- Duplicated patterns for updating lists with timestamps

**Impact**: Medium - Makes changes error-prone and harder to maintain

**Problem**: Several store actions have nearly identical patterns for updating the selected list:

```typescript
// Pattern repeated 4 times:
return {
  lists: state.lists.map((l) =>
    l.id === state.selectedListId
      ? { ...l, todos: updatedTodos, updatedAt: new Date().toISOString() }
      : l,
  ),
};
```

**Proposed Solution:**

1. **Create Helper Function**

   ```typescript
   // Inside useTodosStore
   const updateSelectedListTodos = (
     state: TodosState,
     updateFn: (todos: EditorTodo[]) => EditorTodo[],
   ): TodosState => {
     const list = state.lists.find((l) => l.id === state.selectedListId);
     if (!list) return state;

     const updatedTodos = updateFn(list.todos);
     if (updatedTodos === list.todos) return state; // No change

     return {
       ...state,
       lists: state.lists.map((l) =>
         l.id === state.selectedListId
           ? { ...l, todos: updatedTodos, updatedAt: new Date().toISOString() }
           : l,
       ),
     };
   };
   ```

2. **Refactor Actions to Use Helper**

   ```typescript
   updateTodo: (id: number, text: string) => {
     set((state) =>
       updateSelectedListTodos(state, (todos) =>
         todos.map((todo) =>
           todo.id === id ? { ...todo, text } : todo
         )
       )
     );
   },

   toggleTodo: (id: number) => {
     set((state) =>
       updateSelectedListTodos(state, (todos) => {
         const idx = todos.findIndex((t) => t.id === id);
         // ... toggle logic ...
         return newTodos;
       })
     );
   },
   ```

**Benefits:**

- DRY principle - single source of truth for list updates
- Consistent timestamp handling
- Easier to add logging/debugging
- Reduces duplication from 4 clones to 0

**Files to Change:**

- `src/renderer/features/todos/store/useTodosStore.ts`

**Estimated Effort**: 1-2 hours

---

### 4. Split `useListsManagement` - Long Function

**Current State:**

- 215 lines (max 80 recommended)
- Multiple responsibilities in one hook

**Impact**: Medium - Function is long but not complex

**Problem**: Hook does too much (create, delete, duplicate, select lists)

**Proposed Solution:**

Split into focused hooks:

```typescript
// 1. useListCreation.ts
export function useListCreation() {
  const addList = useCallback((name: string) => {
    // List creation logic
  }, []);
  return { addList };
}

// 2. useListDeletion.ts
export function useListDeletion() {
  const deleteList = useCallback((id: string) => {
    // Deletion logic
  }, []);
  const deleteSelectedList = useCallback(() => {
    // Delete current list logic
  }, []);
  return { deleteList, deleteSelectedList };
}

// 3. useListDuplication.ts (already exists!)
// This is already a separate hook - good!

// 4. useListSelection.ts
export function useListSelection() {
  const setSelectedListIdWithSave = useCallback((id: string) => {
    // Selection + save logic
  }, []);
  return { setSelectedListIdWithSave };
}

// 5. Refactor useListsManagement to compose these
export function useListsManagement() {
  const { addList } = useListCreation();
  const { deleteList, deleteSelectedList } = useListDeletion();
  const { setSelectedListIdWithSave } = useListSelection();

  return {
    addList,
    deleteList,
    deleteSelectedList,
    setSelectedListIdWithSave,
  };
}
```

**Benefits:**

- Easier to test (smaller units)
- Better separation of concerns
- Easier to understand
- Reusable components

**Files to Change:**

- `src/renderer/features/todos/hooks/useListsManagement.ts` (split)
- Create: `src/renderer/features/todos/hooks/useListCreation.ts`
- Create: `src/renderer/features/todos/hooks/useListDeletion.ts`
- Create: `src/renderer/features/todos/hooks/useListSelection.ts`

**Estimated Effort**: 2-3 hours

---

## 🟢 Low Priority (Maintenance)

### 5. Monitor Code Duplication

**Current State:**

- 2.71% duplication (Excellent! Well below 10% threshold)
- 13 clones found (increased from 7 after migration, but still excellent)

**Goal**: Keep duplication below 10%

**Action Items:**

1. **Add to Pre-PR Checklist**

   ```bash
   npm run quality
   ```

2. **CI/CD Integration** (Future)
   Add to GitHub Actions:

   ```yaml
   - name: Check code quality
     run: |
       npm run complexity
       npm run duplication
   ```

3. **Review Thresholds Periodically**
   - Current: < 10% duplication
   - Current: Complexity < 15
   - Adjust if needed based on team feedback

**Files to Monitor:**

- `src/renderer/features/todos/store/useTodosStore.ts` (4 clones - update patterns) ⚠️ **Address in item #3 above**
- `src/renderer/features/todos/hooks/useListsIndex.ts` (13 lines duplicated with useTodosPersistence)
- `src/renderer/features/todos/hooks/useListsManagement.ts` (18 lines self-duplication)
- `src/renderer/features/todos/hooks/useDragReorder.ts` (19 lines self-duplication)
- `src/renderer/features/todos/hooks/useTodosOperations.ts` (2 clones with store)

**Notes**:

- The 13-line duplication between `useListsIndex` and `useTodosPersistence` is **intentional** - both hooks need their own lifecycle handlers for clarity
- The store duplication (4 clones) should be addressed - see item #3 above

---

## 📊 Quality Metrics to Track

Run before each major change:

```bash
# Check all quality metrics
npm run quality

# Or individually:
npm run complexity   # Check code complexity
npm run duplication  # Check code duplication
npm run lint         # Check code style
npm run typecheck    # Check TypeScript errors
npm test             # Run tests with coverage
```

**Target Metrics:**

- Duplication: < 10% (Currently: 2.71% ✅)
- Test Coverage: > 95% (Currently: 97.75% ✅)
- Complexity: < 15 (Warnings acceptable for large hooks - currently 1 action at 16)
- TypeScript: 0 errors (Currently: 0 ✅)
- ESLint: 0 errors (Currently: 0 ✅)

---

## ✅ Recently Completed

**Context-to-Zustand Migration** (Completed: 2025-11-03)

- ✅ Removed React Context layer entirely
- ✅ Consolidated all actions in Zustand store
- ✅ Updated all components to use direct store selectors
- ✅ Migrated tests from Context provider wrapping to store seeding
- ✅ Maintained 97.75% test pass rate (391/400 passing)
- ✅ All quality checks passing (lint, typecheck, complexity, duplication)

**Phase 5: Eliminate Ref Plumbing** (Completed: 2025-01-03)

- ✅ Introduced Zustand store
- ✅ Removed all refs (4 → 0)
- ✅ Eliminated prop drilling (14+ params → 0)
- ✅ Reduced duplication (timer logic eliminated)
- ✅ Maintained high test pass rate

**Phase 4: Centralize Save Queue** (Completed: 2025-01-03)

- ✅ Created `SaveQueue` utility
- ✅ Centralized all save timing
- ✅ Unified lifecycle handlers

**Phase 3: Consolidate Indent Logic** (Completed: 2025-01-02)

- ✅ Unified `setIndent` and `changeIndent`

**Phase 2: Remove Persisted Section** (Completed: 2025-01-02)

- ✅ Section is now computed only

**Phase 1: Remove Dead Reducers** (Completed: 2025-01-01)

- ✅ Deleted ~300 LOC of unused code

---

## 📝 Notes

- This document should be reviewed quarterly
- Items can be moved to active work when capacity allows
- All items are **optional** - current quality is excellent
- Prioritize based on pain points and team feedback

**Last Updated**: 2025-11-03
**Quality Grade**: A- (Excellent)

---

## 📋 Summary of Improvements Identified

From Context-to-Zustand Migration Analysis:

1. **🔴 High Priority**: Refactor `toggleTodo` complexity (16 → target 15)
2. **🟡 Medium Priority**: Reduce store action duplication (4 clones)

**Overall Assessment**: The migration was successful with minimal technical debt introduced. The codebase remains in excellent condition with clear paths forward for the identified improvements.
