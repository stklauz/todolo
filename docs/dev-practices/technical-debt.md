# Technical Debt & Future Improvements

This document tracks known areas for improvement after the successful Phase 5 architecture cleanup.

**Current Quality Status**: A- (Excellent)

- Duplication: 2.26% ✅
- Test Coverage: 98.4% ✅
- TypeScript: 0 errors ✅
- ESLint: 0 errors ✅

---

## 🔴 High Priority (Optional)

### 1. Refactor `useDragReorder` - High Complexity

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

### 2. Split `useListsManagement` - Long Function

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

### 3. Monitor Code Duplication

**Current State:**

- 2.26% duplication (Excellent! Well below 10% threshold)
- 7 clones found (all small and/or intentional)

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

- `src/renderer/features/todos/hooks/useListsIndex.ts` (13 lines duplicated with useTodosPersistence)
- `src/renderer/features/todos/hooks/useListsManagement.ts` (18 lines self-duplication)
- `src/renderer/features/todos/hooks/useDragReorder.ts` (19 lines self-duplication)

**Note**: The 13-line duplication between `useListsIndex` and `useTodosPersistence` is **intentional** - both hooks need their own lifecycle handlers for clarity.

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

- Duplication: < 10% (Currently: 2.26% ✅)
- Test Coverage: > 95% (Currently: 98.4% ✅)
- Complexity: < 15 (Warnings acceptable for large hooks)
- TypeScript: 0 errors (Currently: 0 ✅)
- ESLint: 0 errors (Currently: 0 ✅)

---

## ✅ Recently Completed

**Phase 5: Eliminate Ref Plumbing** (Completed: 2025-01-03)

- ✅ Introduced Zustand store
- ✅ Removed all refs (4 → 0)
- ✅ Eliminated prop drilling (14+ params → 0)
- ✅ Reduced duplication by 80% (timer logic eliminated)
- ✅ Maintained 98.4% test pass rate

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

**Last Updated**: 2025-01-03
**Quality Grade**: A- (Excellent)
