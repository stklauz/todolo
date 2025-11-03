# Context + Store Redundancy: Architectural Refactor

**Status**: Proposed  
**Priority**: High  
**Complexity**: Medium  
**Created**: 2025-11-03

---

## Executive Summary

The todos feature currently uses **both React Context and Zustand store** for the same state management, creating a redundant architectural layer. This document proposes removing the Context layer and completing the migration to Zustand-only state management.

**TL;DR**: Remove `TodosProvider`, `TodosContext`, and `TodosActionsContext`. Access Zustand store directly via hooks. Reduce complexity, improve performance, eliminate confusion.

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

**File Count**: 3 unnecessary files

- `src/renderer/features/todos/contexts/TodosProvider.tsx` (112 lines)
- `src/renderer/features/todos/contexts/TodosContext.tsx` (49 lines)
- `src/renderer/features/todos/contexts/TodosActionsContext.tsx` (95 lines)

**Total**: 256 lines of redundant code to maintain, test, and debug.

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

**After** (Option B - Convenience hooks, recommended):

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

### Phase 1: Preparation (Low Risk)

- ✅ Document current architecture
- ✅ Identify all components using Context
- ✅ Create migration plan
- ✅ Set up branch for refactor

### Phase 2: Store Enhancement (Medium Risk)

- 🔲 Move all actions from `useTodosOperations` to store
- 🔲 Move all actions from `useListsManagement` to store
- 🔲 Move persistence logic to store (or keep separate with store access)
- 🔲 Add comprehensive unit tests for store actions
- 🔲 Ensure 100% test coverage for store

### Phase 3: Create Convenience Hooks (Low Risk)

- 🔲 Create `useTodosHelpers.ts` with convenience hooks
- 🔲 Ensure API matches current Context API (backward compatible)
- 🔲 Add tests for convenience hooks

### Phase 4: Component Migration (High Risk)

- 🔲 Update all components to use new hooks (one by one)
- 🔲 Update all tests to use store mocking
- 🔲 Run full test suite after each component migration
- 🔲 Verify no regressions in UI behavior

### Phase 5: Cleanup (Low Risk)

- 🔲 Remove `TodosProvider` from `App.tsx`
- 🔲 Delete Context files
- 🔲 Remove Context exports from barrel files
- 🔲 Update documentation
- 🔲 Run final test suite
- 🔲 Performance benchmarks (before/after)

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

- ✅ Remove 256 lines of redundant code (3 Context files)
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

### Performance Tests

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

- Feature flag (if time permits): `USE_ZUSTAND_ONLY`
- Can toggle between architectures during rollout
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

### Code Quality

- [ ] Lines of code: -256 (delete 3 Context files)
- [ ] Complexity: maintained or reduced
- [ ] Test coverage: ≥ 90% for store

### Performance

- [ ] Re-renders: 20-40% reduction (measured)
- [ ] Bundle size: ~1-2KB reduction (gzipped)
- [ ] Time to interactive: no regression

### Developer Experience

- [ ] Time to understand state management: reduced (single pattern)
- [ ] Time to add new action: reduced (no Context boilerplate)
- [ ] Test setup complexity: reduced (no providers)

---

## References

### Zustand Documentation

- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions)
- [Zustand vs Context Performance](https://blog.logrocket.com/zustand-vs-usecontext/)

### Internal Documentation

- `docs/phase5-review-response.md` - Phase 5 refactor notes
- `docs/cleanup-architecture.md` - Architecture cleanup plans
- `src/renderer/features/todos/store/useTodosStore.ts` - Current store implementation

### Related Work

- Phase 5: Zustand introduction (completed, but incomplete)
- This refactor: Complete the Phase 5 vision

---

## Timeline Estimate

| Phase                        | Estimated Time  | Risk Level |
| ---------------------------- | --------------- | ---------- |
| Phase 1: Preparation         | 1 hour          | Low        |
| Phase 2: Store Enhancement   | 4-6 hours       | Medium     |
| Phase 3: Convenience Hooks   | 2 hours         | Low        |
| Phase 4: Component Migration | 6-8 hours       | High       |
| Phase 5: Cleanup             | 2 hours         | Low        |
| **Total**                    | **15-19 hours** | **Medium** |

### Breakdown

- Store actions refactor: 4-6 hours
- Component updates: 6-8 hours (20+ components)
- Test updates: 4-5 hours (50+ tests)
- Documentation: 2 hours
- Buffer: 2-3 hours

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

## Approval & Sign-off

**Proposed by**: AI Assistant  
**Date**: 2025-11-03

**Approved by**: **\*\*\*\***\_\_\_**\*\*\*\***  
**Date**: **\*\*\*\***\_\_\_**\*\*\*\***

**Review Notes**:

- [ ] Technical approach reviewed
- [ ] Risks assessed and mitigated
- [ ] Timeline approved
- [ ] Testing strategy approved
- [ ] Ready to implement
