# Todo Architecture Cleanup Plan

## Context

The todo management system has accumulated complexity through incremental development:

- Unused reducer pattern (300+ LOC dead code)
- Dual hierarchy fields (`parentId` vs `indent` causing drift)
- Persisted `section` field creating consistency issues
- Duplicate logic in `setIndent` and `changeIndent`
- Excessive ref plumbing (13 parameters passed between hooks)
- Scattered save/debounce logic

Two independent reviews identified overlapping issues. This document consolidates recommendations into a cohesive cleanup plan.

## Goals

1. Remove dead code to reduce confusion
2. Eliminate dual sources of truth (section, indent)
3. Reduce duplication in business logic
4. Simplify state management
5. Improve testability
6. Maintain backward compatibility

## Implementation Phases

This is sequenced from smallest/safest to most impactful:

### Phase 1: Delete Dead Reducers (1-2 hours)

**Impact:** Immediate clarity, removes 300+ LOC

**Problem:**

- `todosReducer.ts` and `listsReducer.ts` are fully implemented
- Comprehensive test coverage exists
- **Zero production usage** — app uses hook-based state instead
- Creates confusion about which implementation to follow
- Tests are misleading

**Steps:**

- [x] Verify reducers are truly unused: `grep -r "todosReducer\|listsReducer" src/renderer/` (should only find test files)
- [x] Delete `src/renderer/features/todos/reducers/` directory
- [x] Delete `src/renderer/features/todos/reducers/__tests__/` directory
- [x] Run full test suite to ensure nothing breaks
- [x] Verify TypeScript compiles cleanly

**Rollback:** Git revert if needed (low risk)

---

### Phase 2: Remove Persisted `section` Field (2-3 hours)

**Impact:** Prevents state drift, simplifies data model

**Problem:**

- `section` field is **both computed AND persisted** in database
- Risk of drift between stored values and computed effective state
- Database stores it (line 395 in `db.ts`), but UI also derives it
- No single source of truth

**Evidence:**

```typescript
// From db.ts line 395: Stored in DB
section: t.section || null,

// From todoUtils.ts line 36-53: Also computed
export const computeTodoSection = (todo, todos) => {
  // Complex logic to derive section...
}
```

**Steps:**

- [x] Audit current data: query DB for todos with `section` populated
- [x] Update database schema: stop writing `section` column
- [x] Update `saveListTodos` in `src/main/db.ts`: remove `section` from INSERT
- [x] Update `loadListTodos` in `src/main/db.ts`: ignore `section` column when reading
- [x] Update `storage.ts` migration: no longer populate `section`
- [x] Verify `computeTodoSection()` is used everywhere in UI
- [x] Remove `section` from `EditorTodo` type
- [x] Remove `section` from database schema (optional, can leave column empty)
- [x] Add tests: verify computed section matches expected behavior

**Rollback:** SQL migration to repopulate `section` if needed

---

### Phase 3: Consolidate Indent Logic (2-3 hours)

**Impact:** Reduces duplication, prevents logic drift

**Problem:**

- `setIndent` and `changeIndent` have nearly identical parent-finding logic
- Lines 127-179 and 184-232 in `useTodosOperations.ts` duplicate ~50 lines
- Easy for logic to drift between the two functions

**Evidence:**

```typescript:src/renderer/features/todos/hooks/useTodosOperations.ts
// Lines 127-179: setIndent
if (clamped === 0) {
  updated[targetIndex] = { ...target, parentId: null, indent: 0 };
} else {
  for (let i = targetIndex - 1; i >= 0; i--) {
    const candidate = prev[i];
    if (candidate.parentId == null) {
      const candidateSection = computeSectionById(candidate.id, prev);
      if (canAttachChild(candidateSection, targetSection)) {
        newParentId = candidate.id;
        break;
      }
    }
  }
}

// Lines 184-232: changeIndent (SAME CODE DUPLICATED)
if (newIndent === 0) {
  updated[targetIndex] = { ...target, parentId: null, indent: 0 };
} else {
  for (let i = targetIndex - 1; i >= 0; i--) {
    // ... identical logic
  }
}
```

**Steps:**

- [x] Create pure function in `src/renderer/features/todos/utils/todoUtils.ts`:
  ```typescript
  export const computeParentForIndentChange = (
    todos: EditorTodo[],
    targetId: number,
    targetIndent: number,
  ): number | null => {
    if (targetIndent === 0) return null;

    const targetIndex = todos.findIndex((t) => t.id === targetId);
    const targetSection = computeSectionById(targetId, todos);

    for (let i = targetIndex - 1; i >= 0; i--) {
      const candidate = todos[i];
      if (candidate.parentId == null) {
        const candidateSection = computeSectionById(candidate.id, todos);
        if (canAttachChild(candidateSection, targetSection)) {
          return candidate.id;
        }
      }
    }
    return null;
  };
  ```
- [x] Refactor `setIndent` in `useTodosOperations.ts` to use new function
- [x] Refactor `changeIndent` in `useTodosOperations.ts` to use new function
- [x] Add unit tests for `computeParentForIndentChange`
- [x] Add integration tests: verify indent behavior unchanged
- [x] Run all tests to ensure behavior preserved

**Rollback:** Git revert if behavior changes

---

### Phase 4: Centralize Save Queue (4-6 hours)

**Impact:** Cleaner persistence, easier to test and reason about

**Problem:**

- Save/debounce logic scattered across persistence and operations hooks
- Multiple timers and lifecycle handlers
- Hard to test save behavior in isolation
- Risk of duplicated timing concerns

**Current Issues:**

- `useTodosPersistence` manages save strategy, timers, and lifecycle handlers
- `useTodosOperations` calls `saveWithStrategy` in multiple places
- Window lifecycle handlers (`beforeunload`, `visibilitychange`, `blur`) in multiple files

**Steps:**

- [ ] Create `src/renderer/features/todos/utils/saveQueue.ts`:
  ```typescript
  export class SaveQueue {
    private timer: number | null = null;

    enqueue(reason: SaveReason, listId: string, data: EditorTodo[]) {
      if (reason === 'immediate') {
        this.cancelDebounce();
        this.saveImmediately(listId, data);
      } else {
        this.debounceSave(() => this.saveImmediately(listId, data), 200);
      }
    }

    flush() {
      this.cancelDebounce();
      // Flush pending saves
    }
  }
  ```
- [ ] Update `useTodosPersistence` to use `SaveQueue`
- [ ] Remove duplicate timers from other hooks
- [ ] Add lifecycle handler in one place (window blur/unload)
- [ ] Add unit tests for save queue timing behavior
- [ ] Add integration tests for save behavior
- [ ] Verify existing save behavior preserved

**Rollback:** Keep old save logic behind feature flag initially

---

### Phase 5: Reduce Ref Plumbing (3-4 hours)

**Impact:** Reduced cognitive load, simpler state management

**Problem:**

- `useTodosState` passes 13+ parameters to child hooks
- 4 refs (`idCounterRef`, `selectedListIdRef`, `listsRef`, `loadedListsRef`)
- Manual `useEffect` syncing patterns
- Hard to reason about "current" vs "stale" data

**Current Issues:**

```typescript:src/renderer/features/todos/hooks/useTodosState.ts
// 4 refs needed for closure/stale data avoidance
const idCounterRef = React.useRef(1);
const selectedListIdRef = React.useRef<string | null>(null);
const listsRef = React.useRef<TodoList[]>([]);
const loadedListsRef = React.useRef<Set<string>>(new Set());

// Manual sync
selectedListIdRef.current = selectedListId;
React.useEffect(() => {
  listsRef.current = lists;
}, [lists]);

// 13 parameters passed to child hook
useListsManagement({
  lists, setLists, selectedListId, setSelectedListId,
  listsRef, loadedListsRef, saveWithStrategy, flushCurrentTodos
});
```

**Options:**

- **Option A:** Use Context-based store (like Zustand) — recommended
- **Option B:** Consolidate related hooks — simpler but less structured

**Steps (Option A - Context Store):**

- [ ] Install `zustand` or create lightweight context store
- [ ] Migrate state to store: `lists`, `selectedListId`, `loadedLists`, `idCounter`
- [ ] Update operations to use store instead of props
- [ ] Remove ref plumbing
- [ ] Remove manual `useEffect` syncing
- [ ] Add tests for store behavior
- [ ] Verify all tests pass

**Steps (Option B - Consolidation):**

- [ ] Merge `useListsIndex` and `useListsManagement` into `useListsState`
- [ ] Merge `useTodosPersistence` operations into `useTodosOperations`
- [ ] Reduce parameter passing by consolidating concerns
- [ ] Add tests
- [ ] Verify behavior preserved

**Rollback:** Revert to old pattern if issues arise

---

## Cleanup Checklist Summary

### Phase 1: Dead Code Removal

- [x] Delete `src/renderer/features/todos/reducers/` directory
- [x] Delete reducer tests
- [x] Verify nothing breaks

### Phase 2: Section Field

- [x] Stop persisting `section` in database
- [x] Remove `section` from `EditorTodo` type
- [x] Verify computed section works everywhere
- [x] Add tests

### Phase 3: Indent Logic

- [x] Extract `computeParentForIndentChange` function
- [x] Refactor `setIndent` and `changeIndent` to use it
- [x] Add tests
- [x] Verify behavior unchanged

### Phase 4: Save Queue

- [ ] Create `SaveQueue` class
- [ ] Migrate save logic to queue
- [ ] Remove duplicate timers/handlers
- [ ] Add tests

### Phase 5: Ref Plumbing

- [ ] Choose approach (Context vs Consolidation)
- [ ] Migrate state management
- [ ] Remove refs and manual syncing
- [ ] Add tests

---

## Testing Strategy

After each phase:

1. Run full test suite: `npm test`
2. Type check: `npm run typecheck`
3. Lint: `npm run lint`
4. Manual smoke test: add/edit/delete todos
5. Check coverage: `npm run test:coverage`

**Goal:** Maintain 80%+ coverage throughout cleanup

---

## Migration and De-risking

**Reality Check:** You're the only user. This means:

- **No deployment rollback needed** — if something breaks, just revert git
- **No legacy compatibility needed** — no users on old versions to support
- **Simple migrations are fine** — complex multi-step migrations are overkill

**What to actually do:**

1. **Phase 2 (section field):** Add a simple migration in `applyMigrations()` to drop the column cleanly:

   ```typescript
   // In db.ts applyMigrations()
   if (hasSection) {
     // For SQLite, dropping columns is annoying, so just stop using it
     console.log('[DB] Section column deprecated, will not be used');
   }
   ```

2. **Don't create complex migration frameworks** — you've already tweaked migrations 3 times. Keep it simple.

3. **Incremental rollout:** Still valid — do one phase before starting next (prevents cascading failures)

4. **Git as safety net:** If something breaks, just `git revert`. Much easier than complex rollback logic.

**Recommendation:** Focus on code quality over migration complexity. If a migration fails, you'll notice immediately (only user) and can fix it.

---

## Expected Outcomes

| Metric                 | Before      | After    | Improvement              |
| ---------------------- | ----------- | -------- | ------------------------ |
| Lines of dead code     | ~300 LOC    | 0        | **100% removal**         |
| Hook parameters max    | 13          | 5        | **60% reduction**        |
| Refs per hook          | 4           | 0-1      | **75% reduction**        |
| Dual hierarchy fields  | 2           | 1        | **50% simpler**          |
| Manual change checks   | 20+         | 0        | **removed**              |
| Duplicate indent logic | 2 functions | 1 shared | **50% less duplication** |

---

## References

- Review documents:
  - `docs/todos-architecture-review.md` (targeted improvements)

- Key code locations:
  - `src/renderer/features/todos/reducers/` (unused code)
  - `src/main/db.ts` line 395 (section storage)
  - `src/renderer/features/todos/hooks/useTodosOperations.ts` lines 127-232 (duplicate logic)
  - `src/renderer/features/todos/hooks/useTodosState.ts` (ref plumbing)
  - `src/renderer/features/todos/utils/todoUtils.ts` (section computation)

---

## Notes

- All phases can be done incrementally
- Each phase maintains backward compatibility
- No user-facing changes expected
- Focus is on internal structure
- Tests ensure no regressions

---

## If You Asked Me To Do This... Hypothetically 🤔

**How would I approach it?**

Since you're the only user, I'd do it **in two sessions, not all 5 phases**:

### Session 1: Safe, Mechanical Deletions (1-2 hours)

**Do together:**

- ✅ **Phase 1:** Delete dead reducers (zero risk)
- ✅ **Phase 2:** Stop using `section` field (low risk, just don't write it)
- ✅ **Phase 3:** Extract shared indent logic (low risk, same behavior)

**Why together?** All three are structural cleanups with minimal behavior changes. Phase 1 just deletes code, Phase 2 just stops writing a field, Phase 3 unifies duplicate logic. The tests will catch any issues.

**After Session 1:** Run tests. If green, commit. If red, fix issues immediately.

### Session 2: Architectural Refactors (4-6 hours)

**Do together:**

- ✅ **Phase 4:** Centralize save queue
- ✅ **Phase 5:** Reduce ref plumbing

**Why together?** These are interdependent. You could even do Phase 5 first (state management pattern), then Phase 4 (which uses that pattern). Or vice versa.

**After Session 2:** Run tests again. Probably needs some adjustments, but you're only user so iterate quickly.

**Total: 5-8 hours of focused work, 2 commits.**

**Alternative approach:** If that feels risky, do Session 1 (phases 1-3) first, use it for a few days, then do Session 2 later. Phases 1-3 give 80% of the benefit with 30% of the risk.
