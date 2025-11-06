# Unified Technical Debt Plan

**Status**: Active Backlog  
**Created**: 2025-01-XX  
**Last Updated**: 2025-01-XX  
**Quality Check Date**: 2025-01-XX

---

## Executive Summary

This document consolidates all technical debt items from:

- `docs/ideas/technical-debt-improvements.md`
- `docs/ideas/technical-debt.md`
- `docs/ideas/todo-id-complexity-analysis.md`

**Current Quality Status**: A- (Excellent)

- Duplication: 2.48% ✅ (13 clones)
- Test Coverage: 97.75% ✅
- TypeScript: 0 errors ✅
- ESLint: 0 errors ✅
- Complexity: 1 critical, 3 high priority issues

**Priority Levels:**

- **P0**: Critical - blocks work, security, major bugs
- **P1**: High - next sprint, impacts velocity
- **P2**: Medium - next quarter, quality improvements
- **P3**: Low - nice to have, future considerations

---

## P0: Critical Priority (Do Immediately)

### 0.1. Refactor `useDragReorder` - Critical Complexity

**Status**: 🔴 CRITICAL  
**Validated**: ✅ Yes - 274 lines, complexity 28, nesting depth 5

**Current State:**

- 274 lines (max 80 recommended) - **3.4x over limit**
- Cyclomatic complexity: 28 (max 15) - **1.9x over limit**
- Nesting depth: 5 (max 4)
- 13 lines self-duplication (3 clones)

**Impact**: This is the most complex hook in the codebase and blocks maintainability.

**Root Cause**: Complex drag-and-drop state machine with deeply nested conditionals handling multiple scenarios (drag start, hover, drop validation, reordering).

**Proposed Solution:**

1. **Extract State Machine Pattern**

   ```typescript
   // hooks/useDragState.ts
   type DragState =
     | { type: 'idle' }
     | { type: 'dragging'; itemId: number; section: Section }
     | { type: 'hovering'; itemId: number; targetId: number }
     | { type: 'dropping'; fromIndex: number; toIndex: number };
   ```

2. **Split into Focused Hooks**
   - `hooks/useDragState.ts` - State management (~50 lines)
   - `hooks/useDragHandlers.ts` - Event handlers (~80 lines)
   - `hooks/useDropValidation.ts` - Business logic (~60 lines)
   - `hooks/useDragReorder.ts` - Main orchestrator (~80 lines)

3. **Extract Helper Functions**
   - `utils/dragDropUtils.ts`: `calculateDropPosition()`, `validateDrop()`, `applyReorder()`

**Benefits:**

- Reduces complexity from 28 → ~8 per function
- Easier to test in isolation
- Clearer separation of concerns
- Removes self-duplication

**Effort**: 4-6 hours  
**Risk**: Medium (touches performance-critical code)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] `useDragReorder` split into 3-4 focused hooks
- [ ] Each hook under 80 lines
- [ ] Complexity reduced to < 15 per function
- [ ] All drag-and-drop tests pass
- [ ] Performance benchmarks show no regression
- [ ] Self-duplication removed

**Files to Change:**

- `src/renderer/features/todos/hooks/useDragReorder.ts` (refactor)
- Create: `src/renderer/features/todos/hooks/useDragState.ts`
- Create: `src/renderer/features/todos/hooks/useDragHandlers.ts`
- Create: `src/renderer/features/todos/hooks/useDropValidation.ts`
- Update: `src/renderer/features/todos/utils/dragDropUtils.ts`

---

## P1: High Priority (Next Sprint)

### 1.1. Split `useTodosPersistence` Hook

**Status**: 🔴 HIGH  
**Validated**: ✅ Yes - 251 lines (3.1x over limit), 4+ responsibilities

**Current State:**

- 251 lines (max 80 recommended)
- 110-line async effect (max 80)
- 32 statements in async function (max 30)
- Responsibilities: Save queue, lazy loading, ID syncing, seed data, window lifecycle

**Proposed Solution:**

```typescript
// Split into:
// hooks/useLazyListLoading.ts - lazy loading only (~80 lines)
// hooks/useAutoSave.ts - save queue only (~60 lines)
// hooks/useWindowLifecycle.ts - blur/unload events (~40 lines)
// utils/seedData.ts - pure function for seed data (~30 lines)
```

**Effort**: 3-4 hours  
**Risk**: Low (well-defined split)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] Split into 3-4 focused hooks
- [ ] Each hook under 80 lines
- [ ] All existing tests pass
- [ ] New hooks have dedicated tests
- [ ] Code coverage maintained or improved

---

### 1.2. Refactor `toggleTodo` - High Complexity

**Status**: 🔴 HIGH  
**Validated**: ✅ Yes - complexity 16, 33 statements, nesting depth 6

**Current State:**

- Complexity: 16 (max 15) - **1 over limit**
- 33 statements (max 30) - **3 over limit**
- Nesting depth: 6 (max 4) - **2 over limit**
- Location: `useTodosStore.ts:169`

**Root Cause**: Complex hierarchical todo toggling with deeply nested conditionals for parent-child relationships (strict vs indent-based).

**Proposed Solution:**

1. **Extract Hierarchy Detection to Utility**

   ```typescript
   // utils/todoHierarchy.ts
   export function findDescendants(
     todos: EditorTodo[],
     parentId: number,
     mode: 'strict' | 'indent',
   ): number[];
   ```

2. **Simplify toggleTodo Action**
   - Extract descendant finding logic
   - Reduce nesting from 6 → 3
   - Separate strict vs indent-based logic

**Effort**: 2-3 hours  
**Risk**: Low (well-isolated change)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] Complexity reduced to ≤ 15
- [ ] Nesting depth ≤ 4
- [ ] Statements ≤ 30
- [ ] Hierarchy utilities have dedicated tests
- [ ] All toggle tests pass

**Files to Change:**

- Create: `src/renderer/features/todos/utils/todoHierarchy.ts`
- Update: `src/renderer/features/todos/store/useTodosStore.ts`
- Create: `src/renderer/features/todos/utils/__tests__/todoHierarchy.test.ts`

---

### 1.3. Remove `any` Types in Persistence Layer

**Status**: 🟡 HIGH  
**Validated**: ✅ Yes - `useTodosPersistence.ts:185-186`, `validation.ts:6`

**Current State:**

- `useTodosPersistence.ts:185`: `(t: any, i: number)`
- `useTodosPersistence.ts:186`: `const todo: any = {`
- `validation.ts:6`: `normalizeTodo = (todo: any, ...)`

**Problem**: Type safety breaks at database boundary. Runtime errors possible if database format changes.

**Proposed Solution:**

```typescript
// Define raw database shape
type TodoDocRaw = {
  id?: unknown;
  text?: unknown;
  completed?: unknown;
  checked?: unknown; // Legacy
  indent?: unknown;
  parentId?: unknown;
};

// Normalize with runtime validation
function normalizeTodoDoc(raw: TodosDocRaw): TodosDoc {
  // Runtime validation with helpful errors
}
```

**Effort**: 2-3 hours  
**Risk**: Low (additive changes)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] No `any` types in persistence layer
- [ ] Raw database types defined
- [ ] Normalization functions with validation
- [ ] Helpful error messages for invalid data
- [ ] Tests for normalization edge cases

**Files to Change:**

- `src/renderer/features/todos/hooks/useTodosPersistence.ts`
- `src/renderer/features/todos/utils/validation.ts`
- Create: `src/renderer/features/todos/types/storage.ts`

---

### 1.4. Extract Magic Numbers to Constants

**Status**: 🟡 HIGH  
**Validated**: ✅ Yes - Found: `0.3` (audio), `200` (debounce), `0..1` (indent range)

**Current State:**

- `TodoList.tsx:131`: `audio.volume = 0.3`
- `useTodosPersistence.ts:75`: `enqueue('debounced', 200)`
- `useTodosStore.ts:225`: `Math.max(0, Math.min(1, ...))`
- Multiple places: indent clamping `0..1`

**Proposed Solution:**

```typescript
// src/renderer/features/todos/utils/constants.ts
export const AUDIO_CONFIG = {
  VOLUME: 0.3,
  PRELOAD: 'auto' as const,
} as const;

export const SAVE_TIMING = {
  DEBOUNCE_MS: 200,
  IMMEDIATE_MS: 0,
} as const;

export const TODO_CONSTRAINTS = {
  MIN_INDENT: 0,
  MAX_INDENT: 1,
  MIN_ID: 1,
} as const;
```

**Effort**: 2 hours  
**Risk**: Very low (straightforward refactor)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] All magic numbers extracted to `constants.ts`
- [ ] Constants properly typed (`as const`)
- [ ] All usages updated
- [ ] Constants file has JSDoc comments
- [ ] All tests pass

---

### 1.5. Reduce Store Action Duplication

**Status**: 🟡 HIGH  
**Validated**: ✅ Yes - 4 clones in `useTodosStore.ts` (confirmed by duplication report)

**Current State:**

- 4 code clones (11, 7, 10, 10 lines)
- Duplicated pattern: `lists.map((l) => l.id === selectedListId ? { ...l, todos: updatedTodos, updatedAt: ... } : l)`

**Proposed Solution:**

```typescript
// Helper function inside useTodosStore
const updateSelectedListTodos = (
  state: TodosState,
  updateFn: (todos: EditorTodo[]) => EditorTodo[],
): TodosState => {
  // Single source of truth for list updates
};
```

**Effort**: 1-2 hours  
**Risk**: Very low (refactor only)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] Helper function created
- [ ] 4 clones reduced to 0
- [ ] All store tests pass
- [ ] Consistent timestamp handling

---

### 1.6. Optimize Todo ID Lookups (Short-term)

**Status**: 🟡 HIGH  
**Validated**: ✅ Yes - 67 `.find()`/`.findIndex()` operations found

**Current State:**

- 62+ instances of O(n) linear searches
- Operations like `toggleTodo`, `updateTodo` do multiple passes
- `isDescendantInList`: O(n \* depth) worst case

**Proposed Solution (Option 4 - Incremental):**

```typescript
// utils/todoLookup.ts
export function createTodoIndex(todos: EditorTodo[]): Map<number, number> {
  const index = new Map<number, number>();
  todos.forEach((todo, idx) => index.set(todo.id, idx));
  return index;
}

export function findTodoById(
  todos: EditorTodo[],
  id: number,
  index?: Map<number, number>,
): EditorTodo | undefined {
  if (index) {
    const idx = index.get(id);
    return idx !== undefined ? todos[idx] : undefined;
  }
  return todos.find((t) => t.id === id);
}
```

**Effort**: 2-3 hours  
**Risk**: Low (additive, can be incremental)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] Lookup utilities created
- [ ] Hot paths updated to use index
- [ ] Performance improvement measurable
- [ ] All tests pass

**Note**: This is the short-term solution from `todo-id-complexity-analysis.md`. Medium-term (Option 2: per-list maps) can follow if needed.

---

## P2: Medium Priority (Next Quarter)

### 2.1. Refactor `handleBackspaceKey` - High Complexity

**Status**: 🟡 MEDIUM  
**Validated**: ✅ Yes - complexity 19, 47 statements, 8 parameters

**Current State:**

- Complexity: 19 (max 15) - **4 over limit**
- 47 statements (max 30) - **17 over limit**
- 8 parameters (max 6) - **2 over limit**
- Location: `useTodoKeyboardHandlers.ts:107`

**Proposed Solution:**

- Extract sub-functions for different backspace scenarios
- Reduce parameters by grouping related ones
- Split into: `handleBackspaceAtStart()`, `handleBackspaceInText()`, etc.

**Effort**: 2-3 hours  
**Risk**: Medium (keyboard handling is critical)  
**Blockers**: None

---

### 2.2. Split `useListsManagement` Hook

**Status**: 🟡 MEDIUM  
**Validated**: ✅ Yes - 215 lines (2.7x over limit), 18 lines self-duplication

**Current State:**

- 215 lines (max 80 recommended)
- 2 self-duplication clones (18 lines, 8 lines)

**Proposed Solution:**
Split into:

- `hooks/useListCreation.ts` (~50 lines)
- `hooks/useListDeletion.ts` (~60 lines)
- `hooks/useListSelection.ts` (~40 lines)
- `hooks/useListsManagement.ts` - composer (~30 lines)

**Effort**: 2-3 hours  
**Risk**: Low (mostly moving code)  
**Blockers**: None

---

### 2.3. Reduce Large Component Size

**Status**: 🟡 MEDIUM  
**Validated**: ✅ Yes - 331 lines (4.1x over 80 line recommendation)

**Issue**: `TodoList.tsx` is 331 lines, well over threshold

**Proposed Solution:**
Split into:

- `components/TodoList/TodoList.tsx` (main container, ~150 lines)
- `components/TodoList/hooks/useAudioPlayer.ts` (~30 lines)
- `components/TodoList/TodoSection.tsx` (~80 lines)
- `components/TodoList/useTodoListHandlers.ts` (~60 lines)

**Effort**: 4 hours  
**Risk**: Low (mostly moving code)  
**Blockers**: None

---

### 2.4. Add Structured Error Handling

**Status**: 🟡 MEDIUM  
**Validated**: ✅ Yes - errors logged but user has no visibility

**Current Pattern:**

```typescript
try {
  await saveListTodos(listId, data);
} catch (error) {
  debugLogger.log('error', 'Save failed', { error });
  // User doesn't know it failed
}
```

**Proposed Solution:**

1. Create error types (`TodosError`, `SaveError`, `LoadError`)
2. Add error boundary component
3. Add user notifications (toast/banner)
4. Store error state for display

**Effort**: 4-5 hours  
**Risk**: Medium (impacts UX)  
**Blockers**: UI design input (optional)

---

### 2.5. Add Consistent Barrel Exports

**Status**: 🟢 MEDIUM  
**Validated**: ✅ Yes - inconsistent patterns found

**Current State:**

- Some places: `import { useTodosContext } from '../../contexts'`
- Others: `import { TodoList } from '../../components/TodoList/TodoList'`

**Proposed Solution:**

- Create barrel exports for all feature directories
- Update all imports to use barrels
- No default exports (use named exports)

**Effort**: 2 hours  
**Risk**: Very low (no logic changes)  
**Blockers**: None

---

### 2.6. Refactor Drag Handler Caching

**Status**: 🟢 MEDIUM  
**Validated**: ✅ Yes - `TodoList.tsx:139-164` uses ref-based caching

**Issue**: Complex ref-based handler caching is hard to understand

**Current State:**

- `dragStartByIdRef` ref with Map cache
- `getDragStart` callback that creates/retrieves handlers
- Pattern: Cache handlers per todo ID to avoid re-renders

**Options:**

- **A**: Use `React.memo` with custom comparison
- **B**: Use library like `use-memo-one`
- **C**: Document current approach (recommended first step)

**Recommendation**: Start with Option C (document), then evaluate Option A if onboarding feedback suggests confusion.

**Effort**: 2-3 hours  
**Risk**: Medium (touches performance-critical code)  
**Blockers**: Team feedback

---

## P3: Low Priority (Future Considerations)

### 3.1. Remove Unused Action Types

**Status**: 🟢 LOW  
**Validated**: ✅ Yes - `types.ts:33-46` defines unused action types

**Issue**: Defined but unused Redux-style action types

**Current State:**

- `TodoAction` type (lines 33-39) - 6 action variants
- `ListAction` type (lines 41-46) - 5 action variants
- Not used anywhere (project uses Zustand, not Redux)

**Options:**

- **A**: Remove entirely (if committed to Zustand)
- **B**: Integrate with Zustand middleware
- **C**: Convert to use with `useReducer`

**Recommendation**: Remove (Option A) unless specific plan to use them.

**Effort**: 30 minutes  
**Risk**: Very low  
**Blockers**: Decision on future state management

---

### 3.2. Optimize Todo ID Lookups (Medium-term)

**Status**: 🟢 LOW  
**Validated**: ✅ Yes - from `todo-id-complexity-analysis.md`

**Proposed Solution (Option 2 - Per-List ID Maps):**

- Keep current structure (numbers, per-list scope)
- Add `Map<number, EditorTodo>` index per list
- Maintain index alongside todos array

**Effort**: 4-6 hours  
**Risk**: Medium (state management changes)  
**Blockers**: Evaluate Option 1.6 first

---

### 3.3. Optimize Todo ID Lookups (Long-term)

**Status**: 🟢 LOW  
**Validated**: ✅ Yes - from `todo-id-complexity-analysis.md`

**Proposed Solution (Option 1 - Globally Unique UUIDs):**

- Change todo IDs from `number` to `string` (UUIDs)
- Requires database migration
- Breaking change

**Effort**: 1-2 weeks  
**Risk**: High (breaking change, migration)  
**Blockers**: Strategic decision, only if cross-list features needed

---

### 3.4. Formalize Database Schema & Migrations

**Status**: 🟢 LOW  
**Validated**: ✅ Yes - no formal migration strategy

**Current Approach:**

- Version field in storage (`version: 1` or `version: 2`)
- Ad-hoc handling in persistence layer

**Proposed Solution:**

- Create migration system with `up`/`down` functions
- Or: Migrate to SQLite with proper schema management

**Effort**: 4-6 hours (migration system), 1-2 weeks (SQLite)  
**Risk**: Medium to high  
**Blockers**: Strategic decision

---

### 3.5. Add Offline/Conflict Resolution

**Status**: 🟢 LOW  
**Validated**: ✅ Yes - no explicit handling for save failures, multiple windows

**Proposed Features:**

- Optimistic UI updates
- Conflict resolution (multiple windows)
- Dirty state tracking
- Visual indicator for unsaved changes

**Effort**: 8-12 hours  
**Risk**: High (impacts data integrity)  
**Blockers**: User research (how often does this happen?)

---

### 3.6. Evaluate Electron Alternatives

**Status**: 🟢 LOW  
**Validated**: ✅ Yes - Electron adds ~100MB+ to bundle

**Alternatives:**

- Tauri (Rust-based, 10x smaller)
- PWA (web-first, no install)
- React Native (mobile + desktop)

**Effort**: Research: 2-4 hours, Migration: 2-3 weeks  
**Risk**: Very high (platform change)  
**Blockers**: Strategic decision, user feedback

---

## Implementation Roadmap

### Sprint 1 (P0 + P1 Critical) - ~15-20 hours

**Week 1:**

1. **P0.1**: Refactor `useDragReorder` (4-6h) - **CRITICAL**
2. **P1.2**: Refactor `toggleTodo` (2-3h) - **HIGH**

**Week 2:** 3. **P1.4**: Extract magic numbers (2h) - **Quick win** 4. **P1.3**: Remove `any` types (2-3h) - **Safety** 5. **P1.1**: Split `useTodosPersistence` (3-4h) - **Complexity**

**Week 3:** 6. **P1.5**: Reduce store duplication (1-2h) - **Quick win** 7. **P1.6**: Optimize ID lookups (2-3h) - **Performance**

**Total**: ~16-23 hours

---

### Sprint 2 (P1 Remaining + P2 High) - ~12-18 hours

**Week 1:**

1. **P2.1**: Refactor `handleBackspaceKey` (2-3h)
2. **P2.2**: Split `useListsManagement` (2-3h)

**Week 2:** 3. **P2.3**: Reduce large component size (4h) 4. **P2.5**: Add barrel exports (2h) - **Quick win**

**Week 3:** 5. **P2.4**: Add error handling (4-5h) 6. **P2.6**: Document/refactor drag handlers (2-3h)

**Total**: ~16-20 hours

---

### Sprint 3+ (P2 Remaining + P3) - As capacity allows

- **P3.1**: Remove unused types (30m)
- **P3.2**: Medium-term ID optimization (4-6h)
- **P3.3**: Long-term ID optimization (1-2 weeks) - **Strategic**
- **P3.4**: Database migrations (4-6h or 1-2 weeks)
- **P3.5**: Offline/conflict resolution (8-12h)
- **P3.6**: Platform evaluation (research)

---

## Success Metrics

### Code Quality Targets

**Immediate (After Sprint 1):**

- [ ] Complexity: All functions ≤ 15
- [ ] Line count: All hooks ≤ 80 lines
- [ ] Duplication: Maintain < 3% (currently 2.48%)
- [ ] Type safety: 0 `any` types in persistence layer
- [ ] Test coverage: Maintain ≥ 95%

**Medium-term (After Sprint 2):**

- [ ] All hooks under 80 lines
- [ ] All functions under complexity 15
- [ ] Consistent import patterns (barrel exports)
- [ ] User-visible error handling

**Long-term:**

- [ ] ID lookup performance: O(1) for hot paths
- [ ] Database migration system in place
- [ ] Offline/conflict resolution (if needed)

### Developer Experience

- [ ] Onboarding time: Reduced (clearer patterns)
- [ ] Time to add feature: Reduced (less navigation)
- [ ] Bug fixing time: Reduced (better debugging)
- [ ] Code review time: Reduced (smaller, focused PRs)

### User Experience

- [ ] Error visibility: Improved (user notifications)
- [ ] App reliability: Maintained or improved
- [ ] Performance: Maintained or improved (ID lookups)

---

## Validation Summary

### ✅ Confirmed Issues (From Quality Check)

1. **useDragReorder**: 274 lines, complexity 28, nesting 5 - **CRITICAL**
2. **toggleTodo**: complexity 16, 33 statements, nesting 6 - **HIGH**
3. **useTodosPersistence**: 251 lines - **HIGH**
4. **handleBackspaceKey**: complexity 19, 47 statements, 8 params - **MEDIUM**
5. **useListsManagement**: 215 lines, 2 clones - **MEDIUM**
6. **Store duplication**: 4 clones - **HIGH**
7. **Magic numbers**: Found in 3+ locations - **HIGH**
8. **`any` types**: Found in persistence layer - **HIGH**
9. **ID lookups**: 67 `.find()` operations - **HIGH**

### ✅ All Items Verified

All items have been validated against the codebase:

1. **TodoList.tsx**: 331 lines (confirmed)
2. **Drag handler caching**: Found in `TodoList.tsx:139-164` (confirmed)
3. **Unused action types**: Found in `types.ts:33-46` (confirmed)

---

## Notes

**Philosophy**: Technical debt is normal and healthy. The key is:

1. **Identifying it** (this document)
2. **Prioritizing it** (P0-P3 system)
3. **Addressing it incrementally** (don't block feature work)
4. **Measuring impact** (success metrics)

**Balance**: Aim for 70% feature work, 30% technical debt/refactoring in each sprint.

**Review Schedule:**

- Weekly: Update progress on active items
- Monthly: Reprioritize backlog
- Quarterly: Review completed items and ROI

**Documentation**: Update this document as items are completed. Move completed items to `docs/done/` for historical reference.

---

## Related Documents

- `docs/ideas/technical-debt-improvements.md` - Original P1-P3 items
- `docs/ideas/technical-debt.md` - Original High/Medium/Low items
- `docs/ideas/todo-id-complexity-analysis.md` - ID lookup optimization analysis
- `docs/ideas/context-store-redundancy.md` - P0 architectural refactor (completed)
- `docs/dev-practices/development-rules.md` - Development standards
- `docs/dev-practices/quality-metrics.md` - Quality thresholds

---

**Last Quality Check**: 2025-01-XX  
**Next Review**: Weekly during active sprints
