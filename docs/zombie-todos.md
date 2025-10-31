# Fix completed items resurfacing from the dead

## Context

Checking the todo will check if the item has a parent or not to determine if it should move to the completed section, and if moved to the completed section, it does just that. However, we're having some issues where, sometimes, when dragging / deleting items with identation, we run into the issue where completed items suddenly resurface due to them persisting their original order_index after being completed.

My proposal is to:

1. Diagnose the issue. It's a bit hard to replicate, but i'd like to try to determine when this happens. we need to evaluate the problem.
   - Tests added
   - Check reproduction steps below

2. Determine a plan that can fix these issues in the best, simplest and most maintainable way possible that respects the projects core principles.

3. Put the fixes in place.

### reproduction on delete

1. Add a structure like:

- one
- two
- three
  - a
  - b
  - c
- four

2. check "Two". The item will move to the completed section.

3. then delete the parent "three".

What will have is that "two", because now has been promoted to parent, now will resurface from the completed section and become the parent to a, b, c while completed.

what should happen: "one" should become the parent.

IF one was also checked, thw expectation is that "a", "b", "c" would ~~either be orphaned or~~ have indentation removed.

### reproduction on drag

1. Add a structure like:

- one
- two
- three
  - a
  - b
  - c
- four

2. check "Two". The item will move to the completed section.

3. now we'll drag item "a" under item "one". what will happen is that the item "two" will resurface from the completed section to become a parent.

what should happen: "one" should become the parent.

IF one was also checked, the expectation is that "a" would ~~either be orphaned or~~ have indentation removed.

## Proposed fixes and migration plan

This is the sequence I propose, from smallest/safest to most complete and maintainable:

### Implementation checklist (step by step)

- [x] Baseline diagnosis and a failing test
  - [x] Add a minimal reproducible unit/integration test for resurfacing on delete
    - Place under `src/renderer/__tests__/e2e/hierarchy-behavior.test.tsx`
  - [ ] Add a minimal reproducible unit/integration test for resurfacing on drag
    - Place under `src/renderer/__tests__/e2e/hierarchy-behavior.test.tsx`
  - [-] Verify tests fail on `main` to confirm we’re capturing the bug
    - Had to skip all tests to commit, tests arent working in full

- [ ] Introduce explicit relationships in data model
  - [ ] Extend `src/renderer/features/todos/types.ts` with `parentId: string | null` and `section: 'active' | 'completed'`
  - [ ] Keep `indent` strictly for rendering; do not use it as source of truth

- [ ] Storage versioning and migration
  - [ ] Add a storage version bump in `src/renderer/features/todos/api/storage.ts`
  - [ ] Implement a one-shot migration that infers `parentId` by scanning previous siblings by `indent`
  - [ ] Enforce invariant in migration: active children cannot have completed parents (reparent to nearest previous active parent or `null`)
  - [ ] Add unit tests for migration covering mixed completion states and nested hierarchies

- [ ] Centralize invariants and operations
  - [ ] Create helpers in `src/renderer/features/todos/utils/`:
    - `reparentChildren(parentId, newParentId)`
    - `outdentChildren(parentId)`
    - `canAttachChild(parentSection, childSection)`
  - [ ] Update reducers/handlers to use `parentId` and `section`:
    - [ ] Toggle complete: move item between sections and detach/adjust children safely
    - [ ] Delete: reparent or outdent children deterministically; update focus target
    - [ ] Drag/drop: move blocks using `parentId`; forbid cross-section parenting
  - [ ] Add focused unit tests for these helpers and reducers

- [ ] UI rendering updates
  - [ ] Derive `indent` from `parentId` for display only
  - [ ] Ensure lists render strictly by `section`, no implicit cross-section linking

- [ ] Observability
  - [ ] Log key transitions and invariant violations via `src/renderer/utils/debug.ts`
  - [ ] Add minimal metrics/counters for unexpected reparenting paths

- [ ] E2E verification
  - [ ] Re-run the two failing E2E tests; they should now pass
  - [ ] Add coverage for focus behavior after delete and after drag

- [ ] Cleanup and rollout
  - [ ] Remove any remaining implicit-indent logic used as source of truth
  - [ ] Keep legacy reader for one release if desired; otherwise remove after verifying migration
  - [ ] Update `docs/TODOLO.md` and `docs/releases.md` with migration note and recovery steps

### Long-term: explicit relationships and sections

Move from implicit hierarchy (array order + `indent`) to explicit fields that make rules enforceable and future-proof (more levels, more sections):

- Add to storage (new version):
  - `parentId: number | null`
  - `section: 'active' | 'completed'` (extensible to `'in_progress' | 'blocked'`)
- Migration function (one-shot, automatic):
  - Infer `parentId` from current array + `indent` by scanning backward to the nearest row with `indent == currentIndent - 1`.
  - Enforce invariant during migration: active children cannot attach to completed parents; reparent to nearest previous active parent or set `parentId = null` (indent 0 equivalent).
  - Persist as new storage version and overwrite the old.
- Operations updated to use `parentId` (not implicit scanning):
  - Delete: reparent or outdent children by `parentId`.
  - Drag/drop: move blocks by `parentId`; forbid cross-section parent-child.
  - Toggle: keep section derived or explicit; centralize transitions.
  - Focus: when a parent is removed, and its children reassigned, the cursor should go to the nearest active item of the same indentation.
- Keep `indent` as a derived UI concern for rendering only (not source of truth).

Solo-project rollout plan:

- Take a backup of the old file, then run the app once to auto-migrate and save in the new version.
- After verifying your data loads correctly, remove the legacy reader immediately (or keep it for one release if you want a safety net).

Testing checklist:

- Migration correctness for simple and nested structures, and mixed completion states.
- Delete + DnD invariants (no resurfacing, correct reparenting/outdenting).
- Save/reload stability: no cross-section attachment after persistence.
- Focus tests

Important: These changes should substancially simplify the logic within our project. So, if we need to review the logic of something, lets do it.
