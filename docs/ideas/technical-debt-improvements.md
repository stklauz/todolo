# Technical Debt & Improvement Backlog

**Status**: Active Backlog  
**Created**: 2025-11-03  
**Last Updated**: 2025-11-03

---

## Overview

This document tracks medium and small technical debt items identified during the 2025-11-03 architecture review. Items are organized by priority and impact.

**Related Documents:**

- `docs/ideas/context-store-redundancy.md` - P0 architectural refactor
- `docs/dev-practices/technical-debt.md` - General technical debt tracking

---

## Priority Levels

- **P0**: Critical - blocks other work, security issues, major bugs
- **P1**: High - should do next sprint, impacts development velocity
- **P2**: Medium - do in next quarter, quality of life improvements
- **P3**: Low - nice to have, future considerations

---

## P1: High Priority (Next Sprint)

### 1. Split `useTodosPersistence` Hook

**Issue**: Single hook doing too much (245 lines, 4+ responsibilities)

**Current responsibilities:**

- Save queue management
- Lazy loading todos
- ID counter syncing
- Seed data creation
- Window lifecycle events

**Problem**: Violates Single Responsibility Principle. Hard to test, debug, and modify.

**Proposed solution:**

```typescript
// Split into focused hooks:
// hooks/useLazyListLoading.ts - handles lazy loading only
// hooks/useAutoSave.ts - handles save queue only
// hooks/useWindowLifecycle.ts - handles blur/unload events
// utils/seedData.ts - pure function for seed data
```

**Benefits:**

- Each hook has one reason to change
- Easier to test in isolation
- Clearer separation of concerns
- Easier to debug issues

**Effort**: 3-4 hours  
**Risk**: Low (well-defined split)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] `useTodosPersistence` split into 3-4 focused hooks
- [ ] Each new hook has single responsibility
- [ ] All existing tests pass
- [ ] New hooks have dedicated tests
- [ ] Code coverage maintained or improved

---

### 2. Extract Magic Numbers to Constants

**Issue**: Hard-coded values scattered throughout codebase

**Examples:**

```typescript
// TodoList.tsx:104
audio.volume = 0.3; // Why 0.3?

// useTodosPersistence.ts:46
queueRef.current?.enqueue(type, delay); // delay defaults to 200ms - why?

// types.ts:152
indent: Math.max(0, Math.min(1, ...)); // 0..1 range - why?
```

**Problem:**

- Hard to understand rationale
- Hard to change consistently
- No single source of truth for config values

**Proposed solution:**

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

export const UI_TIMING = {
  FOCUS_DELAY_MS: 0,
  ANIMATION_DURATION_MS: 200,
} as const;
```

**Benefits:**

- Self-documenting code
- Easy to adjust values in one place
- Type-safe constants
- Better for testing (can mock constants)

**Effort**: 2 hours  
**Risk**: Low (straightforward refactor)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] All magic numbers extracted to `constants.ts`
- [ ] Constants are properly typed (`as const`)
- [ ] All usages updated to reference constants
- [ ] Constants file has JSDoc comments explaining each value
- [ ] All tests pass

---

### 3. Remove `any` Types in Persistence Layer

**Issue**: Type safety breaks down at database boundary

**Location**: `useTodosPersistence.ts:145-159`

```typescript
// Current (unsafe):
const todosNorm = (fetched.todos || []).map((t: any, i: number) => {
  const todo: any = {
    /* ... */
  };
  // ...
});
```

**Problem:**

- Loses type safety at critical boundary
- Runtime errors possible if database format changes
- No documentation of expected database shape

**Proposed solution:**

```typescript
// Define raw database shape
type TodoDocRaw = {
  id?: unknown;
  text?: unknown;
  completed?: unknown;
  checked?: unknown; // Legacy field
  indent?: unknown;
  parentId?: unknown;
};

type TodosDocRaw = {
  version?: unknown;
  todos?: unknown;
};

// Normalize with runtime validation
function normalizeTodoDoc(raw: TodosDocRaw): TodosDoc {
  // Runtime validation with helpful errors
  if (typeof raw.version !== 'number' || ![1, 2].includes(raw.version)) {
    throw new Error(`Invalid todos doc version: ${raw.version}`);
  }

  if (!Array.isArray(raw.todos)) {
    throw new Error('Invalid todos doc: todos must be array');
  }

  return {
    version: raw.version as StorageVersion,
    todos: raw.todos.map(
      (t: TodoDocRaw, i: number): EditorTodo => normalizeTodo(t, i),
    ),
  };
}

function normalizeTodo(t: TodoDocRaw, fallbackId: number): EditorTodo {
  return {
    id: typeof t.id === 'number' ? t.id : fallbackId + 1,
    text: typeof t.text === 'string' ? t.text : String(t.text ?? ''),
    completed: Boolean(t.completed ?? t.checked ?? false),
    indent: normalizeIndent(t.indent),
    parentId: t.parentId !== undefined ? t.parentId : null,
  };
}
```

**Benefits:**

- Type-safe database layer
- Explicit validation of external data
- Better error messages
- Documents expected database format
- Easier to add migrations

**Effort**: 2-3 hours  
**Risk**: Low (additive changes)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] No `any` types in persistence layer
- [ ] Raw database types defined
- [ ] Normalization functions with validation
- [ ] Helpful error messages for invalid data
- [ ] Tests for normalization edge cases
- [ ] Migration path documented

---

## P2: Medium Priority (Next Quarter)

### 4. Refactor Drag Handler Caching

**Issue**: Complex ref-based handler caching is hard to understand

**Location**: `TodoList.tsx:112-174`

```typescript
// Current (clever but complex):
const dragStartByIdRef = React.useRef(
  new Map<number, (e: React.DragEvent) => void>(),
);
const getDragStart = React.useCallback(
  (id: number) => {
    const ex = dragStartByIdRef.current.get(id);
    if (ex) return ex;
    const fn = (_e: React.DragEvent) => handleDragStart(id);
    dragStartByIdRef.current.set(id, fn);
    return fn;
  },
  [handleDragStart],
);
```

**Problem:**

- Hard to understand for new developers
- Manual cache management error-prone
- Debugging is difficult

**Proposed solution:**

**Option A**: Use `React.memo` with custom comparison

```typescript
const createDragHandlers = useCallback((id: number) => ({
  onDragStart: (e: React.DragEvent) => handleDragStart(id),
  onDragOver: (e: React.DragEvent) => handleDragOver(e, id),
  onDragLeave: () => handleDragLeave(id),
  onDrop: () => handleDropOn(id),
}), [handleDragStart, handleDragOver, handleDragLeave, handleDropOn]);

const TodoRow = React.memo(({ id, ...props }) => {
  const handlers = createDragHandlers(id);
  return <div {...handlers} {...props} />;
}, (prev, next) => {
  // Custom comparison - only re-render if props changed
  return prev.id === next.id
    && prev.text === next.text
    && prev.completed === next.completed;
});
```

**Option B**: Use library like [use-memo-one](https://github.com/alexreardon/use-memo-one)

```typescript
import { useMemoOne } from 'use-memo-one';

const handlers = useMemoOne(
  () => ({
    onDragStart: (e: React.DragEvent) => handleDragStart(id),
    // ...
  }),
  [id, handleDragStart, ...]
);
```

**Option C**: Keep current approach but add extensive comments

```typescript
/**
 * Performance optimization: Cache drag handlers per todo ID
 *
 * Why: Creating new handler functions on every render causes TodoRow
 * to re-render unnecessarily. By caching handlers by ID, we ensure
 * stable references across renders.
 *
 * Trade-off: More complex code for better performance. Worth it for
 * lists with 100+ todos where re-render cost is significant.
 */
const dragStartByIdRef = React.useRef(/* ... */);
```

**Recommendation**: Start with Option C (document current approach), then evaluate Option A if onboarding feedback suggests it's confusing.

**Effort**: 2-3 hours  
**Risk**: Medium (touches performance-critical code)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] Approach selected and documented
- [ ] If refactored: performance benchmarks show no regression
- [ ] Code is easier to understand
- [ ] All tests pass
- [ ] Drag-and-drop works perfectly

---

### 5. Add Structured Error Handling

**Issue**: Inconsistent error handling and no user feedback

**Current pattern:**

```typescript
try {
  await saveListTodos(listId, data);
} catch (error) {
  debugLogger.log('error', 'Save failed', { error });
  // ... but then what? User doesn't know it failed
}
```

**Problem:**

- User has no visibility into failures
- No retry logic for transient failures
- Hard to debug in production

**Proposed solution:**

**Step 1**: Create error types

```typescript
// src/renderer/features/todos/errors.ts
export class TodosError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'TodosError';
  }
}

export class SaveError extends TodosError {
  constructor(
    message: string,
    public readonly listId: string,
    retryable: boolean = true,
  ) {
    super(message, 'SAVE_ERROR', retryable);
  }
}

export class LoadError extends TodosError {
  constructor(
    message: string,
    public readonly listId: string,
    retryable: boolean = true,
  ) {
    super(message, 'LOAD_ERROR', retryable);
  }
}
```

**Step 2**: Add error boundary

```typescript
// src/renderer/components/TodosErrorBoundary.tsx
class TodosErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    debugLogger.log('error', 'Component error', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

**Step 3**: Add user notifications (toast/banner)

```typescript
// Store error state for display
export const useTodosStore = create<TodosState>((set) => ({
  // ...
  errors: [],
  addError: (error: TodosError) => {
    set((state) => ({
      errors: [...state.errors, { ...error, timestamp: Date.now() }],
    }));
  },
  dismissError: (timestamp: number) => {
    set((state) => ({
      errors: state.errors.filter((e) => e.timestamp !== timestamp),
    }));
  },
}));
```

**Effort**: 4-5 hours  
**Risk**: Medium (impacts user experience)  
**Blockers**: None (but could wait for UI design input)

**Acceptance Criteria:**

- [ ] Structured error types defined
- [ ] Error boundary catches component crashes
- [ ] User sees notifications for save/load failures
- [ ] Retryable errors have retry button
- [ ] Errors auto-dismiss after timeout
- [ ] Debug logs still capture errors

---

### 6. Reduce Large Component Size

**Issue**: `TodoList.tsx` is 305 lines and approaching threshold

**Responsibilities:**

- Filtering
- Keyboard handlers
- Drag-and-drop
- Rendering
- Audio playback

**Proposed solution:**

```typescript
// Split into:
// components/TodoList/TodoList.tsx (main container, ~150 lines)
// components/TodoList/hooks/useAudioPlayer.ts (~30 lines)
// components/TodoList/TodoSection.tsx (section rendering, ~80 lines)
// components/TodoList/useTodoListHandlers.ts (consolidated handlers, ~60 lines)
```

**Benefits:**

- Easier to navigate
- Easier to test in isolation
- Clearer separation of concerns
- Follows feature-folder pattern

**Effort**: 4 hours  
**Risk**: Low (mostly moving code)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] `TodoList.tsx` under 200 lines
- [ ] Logic split into focused files
- [ ] All tests pass
- [ ] No behavior changes
- [ ] Imports/exports clean

---

### 7. Add Consistent Barrel Exports

**Issue**: Inconsistent use of barrel files (index.ts)

**Current state:**

```typescript
// Some places have barrel exports:
import { useTodosContext } from '../../contexts';

// Others don't:
import { TodoList } from '../../components/TodoList/TodoList';
import { useTodosStore } from '../../store/useTodosStore';
```

**Proposed solution:**

```typescript
// src/renderer/features/todos/components/index.ts
export { TodoList } from './TodoList';
export { TodoRow } from './TodoRow';
export { ListSidebar } from './ListSidebar';
export { TodoListHeader } from './TodoListHeader';

// src/renderer/features/todos/store/index.ts
export {
  useTodosStore,
  useSelectedList,
  useSelectedTodos,
} from './useTodosStore';

// src/renderer/features/todos/utils/index.ts
export * from './todoUtils';
export * from './validation';
export * from './constants';
// etc...

// Usage:
import { TodoList, TodoRow } from '../../components';
import { useTodosStore } from '../../store';
import { validateTodo, TODO_CONSTRAINTS } from '../../utils';
```

**Benefits:**

- Cleaner imports
- Easier to refactor (centralized exports)
- Better tree-shaking (explicit exports)
- Consistent pattern

**Effort**: 2 hours  
**Risk**: Very low (no logic changes)  
**Blockers**: None

**Acceptance Criteria:**

- [ ] All feature directories have barrel exports
- [ ] All imports updated to use barrels
- [ ] No default exports (use named exports)
- [ ] Bundle size unchanged or reduced
- [ ] All tests pass

---

## P3: Low Priority (Future Considerations)

### 8. Remove Unused Action Types

**Issue**: Defined but unused Redux-style action types

**Location**: `types.ts:32-46`

```typescript
// Defined but never used:
export type TodoAction =
  | { type: 'ADD_TODO'; payload: { text: string; indent: number } }
  | { type: 'UPDATE_TODO'; payload: { id: number; text: string } };
// ...

export type ListAction = { type: 'ADD_LIST'; payload: { name: string } };
// ...
```

**Options:**

- **A**: Remove entirely (if committed to Zustand)
- **B**: Integrate with Zustand middleware for action logging
- **C**: Convert to use with `useReducer` for complex state transitions

**Recommendation**: Remove (Option A) unless there's a specific plan to use them.

**Effort**: 30 minutes  
**Risk**: Very low  
**Blockers**: Decision on future state management approach

---

### 9. Evaluate Electron Alternatives

**Issue**: Electron adds ~100MB+ to bundle size for a simple todo app

**Alternatives to consider:**

- **Tauri**: Rust-based, 10x smaller bundle, faster startup
- **PWA**: Web-first, no install needed, offline support
- **React Native**: Mobile + desktop with shared codebase

**Not saying you should change**, but worth evaluating trade-offs as app matures.

**Effort**: Research: 2-4 hours, Migration: 2-3 weeks  
**Risk**: Very high (platform change)  
**Blockers**: Strategic decision, user feedback

---

### 10. Formalize Database Schema & Migrations

**Issue**: No formal migration strategy for schema changes

**Current approach:**

- Version field in storage (`version: 1` or `version: 2`)
- Ad-hoc handling in persistence layer

**Future needs:**

- What if we need version 3?
- How to handle large todo lists (1000+ items)?
- Concurrent writes?
- Data corruption recovery?

**Proposed approach:**

```typescript
// migrations/index.ts
type Migration = {
  version: number;
  up: (data: any) => any;
  down: (data: any) => any;
};

const migrations: Migration[] = [
  {
    version: 2,
    up: (data) => {
      // v1 → v2: add parentId field
      return {
        version: 2,
        todos: data.todos.map((t) => ({ ...t, parentId: null })),
      };
    },
    down: (data) => {
      // v2 → v1: remove parentId field
      return {
        version: 1,
        todos: data.todos.map(({ parentId, ...t }) => t),
      };
    },
  },
  // Future migrations...
];

function migrateToLatest(data: any): TodosDoc {
  let current = data;
  const currentVersion = current.version ?? 1;
  const targetVersion = Math.max(...migrations.map((m) => m.version));

  for (let v = currentVersion; v < targetVersion; v++) {
    const migration = migrations.find((m) => m.version === v + 1);
    if (migration) {
      current = migration.up(current);
    }
  }

  return current;
}
```

**Alternatives:**

- SQLite (via `better-sqlite3`) - proper database with schema management
- IndexedDB - if moving to web/PWA

**Effort**: 4-6 hours (migration system), 1-2 weeks (SQLite migration)  
**Risk**: Medium to high  
**Blockers**: Strategic decision

---

### 11. Add Offline/Conflict Resolution

**Issue**: No explicit handling for:

- Save failures (disk full, permissions)
- Multiple windows open
- System crash mid-save

**Current behavior**: Unclear / undefined

**Proposed features:**

```typescript
// Optimistic UI updates
- Update UI immediately
- Queue save in background
- Rollback on failure with user notification

// Conflict resolution
- Detect multiple window instances
- Lock file or last-write-wins strategy
- Merge conflicts with user prompt

// Dirty state tracking
- Visual indicator when unsaved changes exist
- Prompt before closing with unsaved changes
- Auto-save more aggressively
```

**Effort**: 8-12 hours  
**Risk**: High (impacts data integrity)  
**Blockers**: User research (how often does this happen?)

---

## Implementation Strategy

### Recommended Order

**Sprint 1** (P1 items):

1. Extract constants (2h) - quick win, low risk
2. Remove `any` types (2-3h) - improves safety
3. Split persistence hook (3-4h) - reduces complexity

**Sprint 2** (P2 items): 4. Add error handling (4-5h) - better UX 5. Consistent barrel exports (2h) - quick win 6. Refactor large component (4h) - quality improvement

**Sprint 3** (P2 items): 7. Document/refactor drag handlers (2-3h) - depends on team feedback

**Future** (P3 items): 8. Remove unused types (30m) - cleanup 9. Database strategy (research) - inform future decisions 10. Platform evaluation (research) - inform future decisions

---

## Tracking & Metrics

### Success Metrics

**Code Quality:**

- [ ] Lines of code: -100 to -200 (removal of duplication/dead code)
- [ ] Complexity: maintained or reduced
- [ ] Test coverage: maintained at 65%+

**Developer Experience:**

- [ ] Onboarding time: reduced (clearer patterns)
- [ ] Time to add feature: reduced (less navigation)
- [ ] Bug fixing time: reduced (better debugging)

**User Experience:**

- [ ] Error visibility: improved (user notifications)
- [ ] App reliability: maintained or improved
- [ ] Performance: maintained or improved

### Review Schedule

- Weekly: Update progress on active items
- Monthly: Reprioritize backlog
- Quarterly: Review completed items and ROI

---

## Notes

**Philosophy**: Technical debt is normal and healthy. The key is:

1. **Identifying it** (this document)
2. **Prioritizing it** (P0-P3 system)
3. **Addressing it incrementally** (don't block feature work)
4. **Measuring impact** (success metrics)

**Balance**: Aim for 70% feature work, 30% technical debt/refactoring in each sprint.

**Documentation**: Update this document as items are completed. Move completed items to `docs/done/` for historical reference.

---

## Related Documents

- `docs/ideas/context-store-redundancy.md` - P0: Architecture refactor
- `docs/dev-practices/development-rules.md` - Development standards
- `docs/dev-practices/quality-metrics.md` - Quality thresholds
- `docs/dev-practices/technical-debt.md` - General debt tracking
