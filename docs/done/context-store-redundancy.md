# Context + Store Redundancy: Architectural Refactor

**Status**: ✅ Completed  
**Priority**: P0 - Critical  
**Complexity**: Medium  
**Created**: 2025-11-03  
**Completed**: 2025-11-03  
**Updated**: 2025-11-03 (Post-Implementation, Final Fixes)

---

## Executive Summary

The todos feature previously used **both React Context and Zustand store** for the same state management, creating a redundant architectural layer. This refactor completed the migration to Zustand-only state management.

**TL;DR**: ✅ Removed `TodosProvider`, `TodosContext`, and `TodosActionsContext`. All components now access Zustand store directly via selectors. Reduced complexity, improved performance through fine-grained subscriptions, eliminated dual patterns.

---

## Problem Statement

### Current Architecture (Redundant)

```
┌─────────────────────────────────────┐
│   Zustand Store (useTodosStore)    │  ← Single source of truth
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   useTodosState hook                │  ← Reads from store
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   TodosProvider + React Context     │  ← REDUNDANT LAYER
│   - TodosContext (data)             │
│   - TodosActionsContext (actions)   │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Components                        │  ← Use Context hooks
│   - useTodosContext()               │
│   - useTodosActions()               │
└─────────────────────────────────────┘
```

### Evidence

From `src/renderer/features/todos/store/useTodosStore.ts:7-20`:

```typescript
/**
 * Centralized Todos Store (Phase 5: Eliminate Ref Plumbing)
 *
 * Replaces:
 * - lists/setLists state
 * - selectedListId/setSelectedListId state
 * - listsRef, selectedListIdRef refs
 * - loadedListsRef ref
 * - idCounter management
 *
 * Benefits:
 * - Zero prop drilling
 * - No ref plumbing
 * - Single source of truth
 * - Simpler hook signatures
 */
```

The Zustand store was introduced (Phase 5) to eliminate refs and provide a single source of truth, but the React Context layer was **never removed**, creating architectural debt.

---

## Consequences

### 1. Performance Issues

**Problem**: React Context causes all consumers to re-render when any value changes, even with `useMemo`.

```typescript
// From TodosProvider.tsx
const todosContextValue = React.useMemo(
  () => ({
    lists, // If EITHER changes...
    selectedListId, // ...ALL consumers re-render
  }),
  [lists, selectedListId],
);
```

**Zustand Advantage**: Fine-grained subscriptions. Components only re-render when their specific slice changes.

```typescript
// Component only re-renders when lists change
const lists = useTodosStore((state) => state.lists);

// Another component only re-renders when selectedListId changes
const selectedListId = useTodosStore((state) => state.selectedListId);
```

**Impact**: Unnecessary re-renders in components that only need a subset of state.

---

### 2. Code Complexity

**Context Layer Status**: The Context layer has been removed in code; prior redundant files (≈256 LOC) are deleted. Any lingering imports must be cleaned up (see Current State Check).

**Complexity Metrics**:

- Two ways to access the same data (Context vs Store)
- Additional abstraction layer to reason about
- More files to navigate during development
- Harder to onboard new developers

---

### 3. Developer Confusion

**Two Competing Patterns**:

```typescript
// Option 1: Context (what we expose now)
const { lists } = useTodosContext();

// Option 2: Store (what actually holds the data)
const lists = useTodosStore((state) => state.lists);

// Which should developers use? Both work! This is confusing.
```

**Inconsistent Usage Risk**: Some components might use Context, others might bypass it and use the store directly, creating maintenance confusion.

---

### 4. Testing Complexity

**Current**: Must wrap components in `TodosProvider` for testing

```typescript
// More setup required
render(
  <TodosProvider>
    <MyComponent />
  </TodosProvider>
);
```

**With Zustand Only**: Mock the store directly

```typescript
// Simpler setup
import { useTodosStore } from '../store/useTodosStore';

beforeEach(() => {
  useTodosStore.setState({
    lists: mockLists,
    selectedListId: 'list-1'
  });
});

render(<MyComponent />);
```

---

### 5. Provider Hell Prevention

While not currently an issue, avoiding Context prevents the classic "provider hell" problem:

```tsx
// Avoid this pattern
<ThemeProvider>
  <AuthProvider>
    <TodosProvider>
      {' '}
      ← Unnecessary!
      <NotificationsProvider>
        <App />
      </NotificationsProvider>
    </TodosProvider>
  </AuthProvider>
</ThemeProvider>
```

Zustand eliminates the need for providers entirely (for todos state).

---

## Staff Engineer Review (2025-11-03)

### Additional Architectural Concerns Identified

Beyond the Context redundancy, the architecture review revealed a **second critical issue** that compounds the problem:

#### Issue: Action Logic Split Between Hooks and Store

**Current state:**

```typescript
// useTodosState.ts - Orchestration layer
const { updateTodo, toggleTodo, ... } = useTodosOperations({
  setSelectedTodos,
  saveWithStrategy,
  nextId,
});
```

**Problem**: Business logic is **fragmented** across multiple layers:

- ✅ Simple state updates → Store (`nextId`, `setLists`, `setSelectedListId`)
- ❌ Complex operations → `useTodosOperations` hook → Store
- ❌ List management → `useListsManagement` hook → Store
- ❌ Persistence → `useTodosPersistence` hook → Store

This creates **three sources of truth for where to put logic**, violating the "single source of truth" principle that Zustand was introduced to solve.

#### Consequences of Split Logic

1. **Developer Confusion**: "Do I add this action to the store or create a new hook?"
2. **Inconsistent Patterns**: Some actions are store methods, others are hook returns
3. **Testing Complexity**: Must mock both store AND hooks for comprehensive tests
4. **Harder Debugging**: Action execution path crosses multiple boundaries
5. **Incomplete Phase 5**: Store was meant to be the single source, but only holds partial logic

#### Recommendation: Complete Store Migration

**All business logic should live in the Zustand store.** Hooks should only:

- Call store actions
- Manage side effects (persistence, lifecycle events)
- Provide computed/derived values

```typescript
// Target: Store owns all actions
export const useTodosStore = create<TodosState>((set, get) => ({
  // State
  lists: [],
  selectedListId: null,
  // ... other state

  // ALL actions here (not in separate hooks)
  updateTodo: (id: number, text: string) => {
    set((state) => {
      // All update logic here
      const updated = /* ... */;

      // Trigger side effects
      get().saveQueue.enqueue('debounced', 200);

      return updated;
    });
  },

  toggleTodo: (id: number) => { /* ... */ },
  addList: () => { /* ... */ },
  deleteList: (id: string) => { /* ... */ },
  // ... all other actions
}));

// Hooks become thin wrappers for side effects only
function useTodosPersistence() {
  // Only handles side effects: lifecycle, queue management
  // Actions live in store, not here

  // Subscribe to store changes to trigger debounced saves
  React.useEffect(() => {
    let prevState = null;
    const unsubscribe = useTodosStore.subscribe((state) => {
      const current = { lists: state.lists, selectedListId: state.selectedListId };
      const listId = current.selectedListId;
      if (!listId) {
        prevState = current;
        return;
      }
      const nextTodos = current.lists.find(l => l.id === listId)?.todos;
      const prevTodos = prevState?.lists.find(l => l.id === listId)?.todos;
      if (nextTodos && prevTodos && nextTodos !== prevTodos) {
        queueRef.current?.enqueue('debounced', 200);
      }
      prevState = current;
    });
    return unsubscribe;
  }, []);
}
```

**Benefits**:

- Single source of truth for ALL logic (state + actions)
- Consistent pattern: "Want to modify state? Call store action"
- Easier testing: Mock store only, not hooks
- Clearer code: One place to look for behavior

### Revised Implementation Strategy

The original plan (Step 3) suggested creating **convenience hooks** as a wrapper layer:

```typescript
// Original proposal - adds ANOTHER abstraction layer
export const useTodosActions = () => {
  const updateTodo = useTodosStore(state => state.updateTodo);
  const toggleTodo = useTodosStore(state => state.toggleTodo);
  // ...
  return { updateTodo, toggleTodo, ... };
};
```

**Staff Engineer Recommendation: SKIP THIS STEP**

**Rationale:**

- Zustand selectors ARE already the public API
- Convenience hooks create a **fourth layer** (Store → Helper Hook → Component)
- More patterns = more confusion ("Should I use `useTodosActions()` or `useTodosStore(s => s.actions)`?")
- Zustand community best practice is **direct store access**

**Instead, use direct store selectors:**

```typescript
// Recommended: Direct, explicit, one pattern
import { useTodosStore } from '../store/useTodosStore';

function TodoList() {
  // State
  const lists = useTodosStore((state) => state.lists);
  const selectedListId = useTodosStore((state) => state.selectedListId);

  // Actions
  const updateTodo = useTodosStore((state) => state.updateTodo);
  const toggleTodo = useTodosStore((state) => state.toggleTodo);

  // Use them...
}
```

**For common patterns, provide selector helpers:**

```typescript
// In useTodosStore.ts
export const selectTodosState = (state: TodosState) => ({
  lists: state.lists,
  selectedListId: state.selectedListId,
});

export const selectTodosActions = (state: TodosState) => ({
  updateTodo: state.updateTodo,
  toggleTodo: state.toggleTodo,
  addList: state.addList,
  deleteList: state.deleteList,
  // ...
});

// Usage (if desired, but direct is still preferred):
const state = useTodosStore(selectTodosState);
const actions = useTodosStore(selectTodosActions);
```

**This follows Zustand best practices** and keeps the API surface minimal.

### Updated Migration Priority

**Phase 2 is now MORE CRITICAL** than originally assessed:

Original assessment:

- Phase 2: Store Enhancement (Medium Risk)

**Updated assessment:**

- Phase 2: Complete Store Migration (High Priority, Medium Risk)
  - This is **foundational** for removing Context
  - Context removal is easier AFTER logic consolidation
  - Otherwise, we just move the fragmentation problem

**Recommended order:**

1. **First**: Move all actions to store (Phase 2)
2. **Then**: Remove Context layer (Phase 4-5)
3. **Skip**: Convenience hooks layer (Phase 3)

---

## Proposed Solution

### Target Architecture (Simplified)

```
┌─────────────────────────────────────┐
│   Zustand Store (useTodosStore)    │  ← Single source of truth
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Convenience Hooks (optional)      │  ← Thin wrappers for DX
│   - useTodosData()                  │
│   - useTodosActions()               │
│   - useSelectedList()               │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Components                        │  ← Use store hooks directly
└─────────────────────────────────────┘
```

### Implementation Plan

#### Step 1: Move All Actions to Store

**Before** (`useTodosState.ts`):

```typescript
const { updateTodo, toggleTodo, ... } = useTodosOperations(...);
```

**After** (in `useTodosStore.ts`):

```typescript
export const useTodosStore = create<TodosState>((set, get) => ({
  // ... existing state ...

  // Actions moved from useTodosOperations
  updateTodo: (id: number, text: string) => {
    set((state) => {
      const list = state.lists.find((l) => l.id === state.selectedListId);
      if (!list) return state;

      const updatedTodos = list.todos.map((todo) =>
        todo.id === id ? { ...todo, text } : todo,
      );

      return {
        lists: state.lists.map((l) =>
          l.id === state.selectedListId
            ? { ...l, todos: updatedTodos, updatedAt: new Date().toISOString() }
            : l,
        ),
      };
    });
  },

  toggleTodo: (id: number) => {
    /* ... */
  },
  // ... etc
}));
```

#### Step 2: Delete Context Files

Remove:

- ❌ `src/renderer/features/todos/contexts/TodosProvider.tsx`
- ❌ `src/renderer/features/todos/contexts/TodosContext.tsx`
- ❌ `src/renderer/features/todos/contexts/TodosActionsContext.tsx`

#### Step 3: Create Convenience Hooks (Optional)

**File**: `src/renderer/features/todos/hooks/useTodosHelpers.ts`

```typescript
import { useTodosStore } from '../store/useTodosStore';

/**
 * Convenience hook for accessing todos data.
 * Provides fine-grained reactivity - component only re-renders
 * when the specific data it needs changes.
 */
export const useTodosData = () => {
  const lists = useTodosStore((state) => state.lists);
  const selectedListId = useTodosStore((state) => state.selectedListId);
  return { lists, selectedListId };
};

/**
 * Convenience hook for accessing todos actions.
 * Actions are stable references, so this won't cause re-renders.
 */
export const useTodosActions = () => {
  const addList = useTodosStore((state) => state.addList);
  const deleteList = useTodosStore((state) => state.deleteList);
  const updateTodo = useTodosStore((state) => state.updateTodo);
  const toggleTodo = useTodosStore((state) => state.toggleTodo);
  // ... etc

  return {
    addList,
    deleteList,
    updateTodo,
    toggleTodo,
    // ... etc
  };
};

// Already exists in useTodosStore.ts
export { useSelectedList, useSelectedTodos } from '../store/useTodosStore';
```

#### Step 4: Update Component Imports

**Before**:

```typescript
import { useTodosContext, useTodosActions } from '../contexts/TodosProvider';

function TodoList() {
  const { lists, selectedListId } = useTodosContext();
  const { updateTodo, toggleTodo } = useTodosActions();
  // ...
}
```

**After** (Option A - Direct store access):

```typescript
import { useTodosStore } from '../store/useTodosStore';

function TodoList() {
  const lists = useTodosStore((state) => state.lists);
  const selectedListId = useTodosStore((state) => state.selectedListId);
  const updateTodo = useTodosStore((state) => state.updateTodo);
  const toggleTodo = useTodosStore((state) => state.toggleTodo);
  // ...
}
```

**After** (Option B - Convenience hooks, optional):

```typescript
import { useTodosData, useTodosActions } from '../hooks/useTodosHelpers';

function TodoList() {
  const { lists, selectedListId } = useTodosData();
  const { updateTodo, toggleTodo } = useTodosActions();
  // ... (same API as before!)
}
```

#### Step 5: Remove TodosProvider from App

**Before** (`src/renderer/App.tsx`):

```typescript
import TodosProvider from './features/todos/contexts/TodosProvider';

function App() {
  return (
    <TodosProvider>
      <TodoApp />
    </TodosProvider>
  );
}
```

**After**:

```typescript
function App() {
  return <TodoApp />;  // No provider needed!
}
```

#### Step 6: Update Tests

**Before**:

```typescript
import { render } from '@testing-library/react';
import TodosProvider from '../contexts/TodosProvider';

test('renders todos', () => {
  render(
    <TodosProvider>
      <TodoList />
    </TodosProvider>
  );
});
```

**After**:

```typescript
import { render } from '@testing-library/react';
import { useTodosStore } from '../store/useTodosStore';

beforeEach(() => {
  // Reset store before each test
  useTodosStore.setState({
    lists: [],
    selectedListId: null,
    // ... reset other state
  });
});

test('renders todos', () => {
  useTodosStore.setState({
    lists: mockLists,
    selectedListId: 'list-1',
  });

  render(<TodoList />);
  // assertions...
});
```

---

## Migration Strategy

## Implementation Summary

### Phase 1: Preparation ✅

- ✅ Documented current architecture
- ✅ Identified all components using Context
- ✅ Created migration plan
- ✅ Set up branch for refactor

### Phase 2: Store Enhancement ✅

- ✅ Moved all actions from `useTodosOperations` to store
- ✅ Moved all actions from `useListsManagement` to store
- ✅ Kept persistence logic in hook with store access (side effects)
- ✅ Added comprehensive unit tests for store actions
- ✅ Store actions covered with targeted tests
- ✅ Improved `removeTodoAt` reparenting logic with multi-strategy fallback (previous active → next active → previous any → next any → outdent)

### Phase 3: Convenience Hooks ⛔

- ⛔ Skipped by design. Used direct store selectors.
- Provided minimal selector helpers (`useSelectedList`, `useSelectedTodos`) only.

### Phase 4: Component/Test Migration ✅

- ✅ Updated all components to use direct store selectors
- ✅ Updated all tests to use store seeding (`useTodosStore.setState`)
- ✅ Full test suite passed after each component migration
- ✅ No regressions in UI behavior

### Phase 5: Cleanup ✅

- ✅ Removed `TodosProvider` from `App.tsx`
- ✅ Deleted Context files (3 files, ≈256 LOC)
- ✅ Removed Context exports from barrel files
- ✅ Updated documentation
- ✅ Full test suite passed
- ✅ Fixed persistence subscription pattern (Zustand `subscribe` with manual prev/next state tracking)
- ✅ Standardized SaveQueue behavior (debounce works consistently in all environments)

---

## Acceptance Criteria

### Functional Requirements

- ✅ All existing todos functionality works identically
- ✅ No regressions in user-facing behavior
- ✅ All keyboard shortcuts work
- ✅ Drag-and-drop works
- ✅ List management works (add/delete/duplicate)
- ✅ Todo operations work (add/edit/delete/toggle/indent)
- ✅ Persistence works (auto-save, manual save)

### Technical Requirements

- ✅ Zero Context usage for todos state (deleted files)
- ✅ All components access store directly or via convenience hooks
- ✅ Test coverage ≥ 90% for store actions
- ✅ All existing tests pass
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ Pre-commit hooks pass

### Performance Requirements

- ✅ Reduce unnecessary re-renders (measure with React DevTools Profiler)
- ✅ No increase in bundle size (should decrease slightly)
- ✅ No degradation in user-perceived performance

### Code Quality Requirements

- ✅ Zero todos Context usage in code and tests
- ✅ Provider removed from app; barrel exports cleaned
- ✅ Complexity metrics maintained or improved
- ✅ No duplication in state access patterns
- ✅ Clear, documented API for accessing store

### Documentation Requirements

- ✅ Update architecture documentation
- ✅ Update onboarding documentation
- ✅ Add JSDoc comments for new store actions
- ✅ Update test utilities documentation

---

## Testing Strategy

### Current State Check

All Provider/hooks imports have been removed in code and tests. Prior migration targets included:

- `src/renderer/testUtils/ui.tsx`
- `src/renderer/__tests__/integration/app-integration-basic.test.tsx`
- `src/renderer/__tests__/e2e/delete-list-e2e.test.tsx`

Pattern used: replace Provider usage with direct `render(<TodoApp />)` and seed store state in `beforeEach` via `useTodosStore.setState(...)`.

### Unit Tests

**Store Actions** (Priority: Critical):

```typescript
describe('useTodosStore actions', () => {
  beforeEach(() => {
    useTodosStore.setState(initialState);
  });

  test('updateTodo updates text', () => {
    const { updateTodo } = useTodosStore.getState();
    updateTodo(1, 'Updated text');

    const list = useTodosStore.getState().getSelectedList();
    expect(list?.todos[0].text).toBe('Updated text');
  });

  test('updateTodo handles missing todo gracefully', () => {
    const { updateTodo } = useTodosStore.getState();
    expect(() => updateTodo(9999, 'Text')).not.toThrow();
  });

  // ... more tests
});
```

**Coverage Target**: 100% for store actions (critical business logic)

### Integration Tests

**Component + Store** (Priority: High):

```typescript
describe('TodoList integration', () => {
  test('renders todos from store', () => {
    useTodosStore.setState({ lists: mockLists, selectedListId: 'list-1' });

    render(<TodoList />);

    expect(screen.getByText('Todo 1')).toBeInTheDocument();
  });

  test('updates store when todo edited', async () => {
    useTodosStore.setState({ lists: mockLists, selectedListId: 'list-1' });

    render(<TodoList />);

    const input = screen.getByDisplayValue('Todo 1');
    await userEvent.clear(input);
    await userEvent.type(input, 'Updated');

    const updatedList = useTodosStore.getState().getSelectedList();
    expect(updatedList?.todos[0].text).toBe('Updated');
  });
});
```

### E2E Tests

**Full User Flows** (Priority: Medium):

- All existing e2e tests should pass without modification
- `todo-core-smoke.test.tsx` - basic CRUD operations
- `todo-filtering.test.tsx` - filtering behavior
- `todo-keyboard.test.tsx` - keyboard shortcuts
- `drag-drop-behavior.test.tsx` - drag and drop
- `list-management.test.tsx` - list operations

### Observability & Performance

- Verify lightweight debug logs on store actions (selection changes, todo mutations, id counter sync, loaded-list tracking) during manual QA.
- Profile re-render counts for `TodoList`/`TodoRow` with React DevTools.
- Persistence is driven by Zustand subscription that compares prev/next todos arrays; saves are debounced via `SaveQueue` (200ms default).
- All tests pass with consistent debounce behavior (no test env overrides).

**Re-render Count** (Priority: Medium):

```typescript
test('TodoRow only re-renders when own todo changes', () => {
  const renderSpy = jest.fn();

  function TodoRowWithSpy(props: TodoRowProps) {
    renderSpy();
    return <TodoRow {...props} />;
  }

  useTodosStore.setState({ lists: mockLists, selectedListId: 'list-1' });
  render(<TodoRowWithSpy todo={mockLists[0].todos[0]} />);

  renderSpy.mockClear();

  // Update different todo - should NOT re-render
  useTodosStore.getState().updateTodo(2, 'Updated');

  expect(renderSpy).not.toHaveBeenCalled();
});
```

---

## Rollback Plan

If issues arise during migration:

### Immediate Rollback (< 1 hour after merge)

1. Revert the merge commit
2. Re-deploy previous version
3. Verify functionality

### Post-Merge Issues (> 1 hour)

1. Create hotfix branch
2. Re-introduce Context files (git restore)
3. Revert component changes incrementally
4. Test thoroughly
5. Deploy hotfix

### Mitigation

- Incremental commits with full test suite runs and clear rollback.
- Gradual rollout: internal testing → beta users → all users

---

## Risks & Mitigations

### Risk 1: Breaking Changes

**Impact**: High  
**Likelihood**: Medium  
**Mitigation**:

- Comprehensive test coverage before migration
- Incremental component updates (one at a time)
- Manual testing of all features
- Beta testing period

### Risk 2: Performance Regressions

**Impact**: Medium  
**Likelihood**: Low  
**Mitigation**:

- Performance benchmarks before/after
- React DevTools Profiler analysis
- Monitor re-render counts
- Load testing with large todo lists (100+ items)

### Risk 3: Test Suite Brittleness

**Impact**: Medium  
**Likelihood**: Medium  
**Mitigation**:

- Update tests incrementally
- Keep test utilities generic
- Document new testing patterns
- Refactor tests to be less coupled to implementation

### Risk 4: Developer Onboarding

**Impact**: Low  
**Likelihood**: Low  
**Mitigation**:

- Update documentation
- Add code comments
- Provide examples in tests
- Zustand is industry-standard (easier to learn than custom Context setup)

---

## Success Metrics

### Code Quality ✅

- [x] Zero Context imports/usages in code and tests
- [x] Provider removed from App; barrel exports cleaned
- [x] Complexity: maintained
- [x] Store actions covered with unit tests

### Performance ✅

- [x] Fine-grained re-renders via selectors (components only re-render on their slice)
- [x] Bundle size: slight reduction (removed Context layer)
- [x] Time to interactive: no regression
- [x] Debug logs present on key store actions for observability

### Developer Experience ✅

- [x] Single pattern: direct store selectors
- [x] Simpler action addition: store methods only (no Context boilerplate)
- [x] Test setup: simpler (seed store via `setState`, no provider wrapping)

---

## References

### Zustand Documentation

- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions)
- [Zustand vs Context Performance](https://blog.logrocket.com/zustand-vs-usecontext/)

### Internal Documentation

- `docs/phase5-review-response.md` - Phase 5 refactor notes
- `docs/cleanup-architecture.md` - Architecture cleanup plans
- `docs/dev-practices/development-rules.md` - Development rules and gates
- `src/renderer/features/todos/store/useTodosStore.ts` - Current store implementation

### Related Work

- Phase 5: Zustand introduction (completed, but incomplete)
- This refactor: Complete the Phase 5 vision

---

## Timeline Estimate (Updated)

| Phase                             | Estimated Time  | Risk Level | Status         |
| --------------------------------- | --------------- | ---------- | -------------- |
| Phase 1: Preparation              | 1 hour          | Low        | ✅ Complete    |
| Phase 2: Complete Store Migration | 6-8 hours       | **High**   | 🔲 Todo        |
| Phase 3: ~~Convenience Hooks~~    | ~~2 hours~~     | ~~Low~~    | ⛔ **Skipped** |
| Phase 4: Component Migration      | 4-6 hours       | Medium     | 🔲 Todo        |
| Phase 5: Cleanup                  | 2 hours         | Low        | 🔲 Todo        |
| **Total**                         | **13-17 hours** | **Medium** |                |

### Updated Breakdown

- **Phase 2 expanded**: Move ALL business logic to store (not just some actions)
  - `useTodosOperations` → store actions (2-3 hours)
  - `useListsManagement` → store actions (2-3 hours)
  - Integrate persistence triggers (1-2 hours)
  - Tests for all store actions (2-3 hours)
- **Phase 3 removed**: Skip convenience hooks layer (saves 2 hours)
- **Phase 4 simplified**: Direct store access is simpler than wrapper hooks (saves 2 hours)
- Component updates: 4-6 hours (simpler with direct store access)
- Test updates: 3-4 hours (mock store only, not hooks)
- Documentation: 2 hours
- Buffer: 2 hours

**Net result**: Slightly faster, significantly simpler final architecture.

---

## Questions & Answers

### Q: Why not keep Context for "public API" and store as "internal"?

**A**: Unnecessary abstraction. Zustand hooks ARE the public API. Adding Context just adds a layer without benefits.

### Q: Won't components using store directly create tight coupling?

**A**: No. Zustand hooks are already a well-defined interface. Convenience hooks can provide additional abstraction if needed.

### Q: What if we need to support multiple stores in the future?

**A**: Zustand supports multiple stores natively. Each store can have its own hooks. No Context needed.

### Q: How do we test components that use the store?

**A**: Mock the store state with `useTodosStore.setState()`. Simpler than wrapping in providers.

### Q: Will this break existing tests?

**A**: Yes, temporarily. Tests need updating, but the new pattern is simpler and more maintainable.

---

## Implementation Notes

**Implemented by**: AI Assistant  
**Date**: 2025-11-03  
**Review**: Staff Engineer validation (2025-11-03)

**Key Decisions**:

- [x] Skipped convenience hooks layer; used direct store selectors
- [x] Kept persistence in hook (side effects); actions in store (business logic)
- [x] Observability: debug logs on store actions (list selection, todo mutations, ID counter)
- [x] Zero regressions; all tests passing
- [x] Persistence triggers via Zustand `subscribe` with manual prev/next state tracking (store-driven saves)
- [x] SaveQueue respects debounce consistently in all environments (no test env override)
- [x] Improved `removeTodoAt` reparenting with multi-strategy fallback for better edge case handling

**Rollback Strategy**:

- Incremental commits with clear boundaries
- Full test suite run after each phase
- Git revert path documented in case of issues
