# Implementation Plan: Option 2 - Keep "Find Best Parent" + Allow Orphans

## Goal

Implement Option 2: Keep "find best parent" logic, but allow orphans when no parent is found (instead of auto-outdenting).

## Strategy

- **Keep**: "Find best parent" logic (reparenting when possible)
- **Change**: When no parent found, allow orphan (`parentId: null, indent: 1`) instead of auto-outdent (`parentId: null, indent: 0`)
- **Remove**: `hasParentAbove` check in keyboard handler (allow first item to indent)
- **Remove**: `fixOrphanedChildren` function (outdated)

## Phase 1: Test Updates

### 1.1 Update Drag-Drop Tests

**File**: `src/renderer/features/todos/hooks/__tests__/useDragReorder.test.tsx`

- **Update**: Tests expecting auto-outdent when no parent found (around lines 598-626)
- **Change**: Expect orphan (`parentId: null, indent: 1`) instead of (`parentId: null, indent: 0`)
- **Keep**: Tests for reparenting when parent found (Examples 3-4 behavior)

### 1.2 Update Keyboard Handler Tests

**File**: `src/renderer/features/todos/hooks/__tests__/useTodoKeyboardHandlers.test.ts`

- **Remove**: Tests preventing first item indentation (lines 103-119, 121-138)
- **Add**: Test allowing first item to be indented (creates orphan)
- **Update**: Test at line 103-119 to expect indent is allowed (no parent check)

### 1.3 Update Delete/Reparent Tests

**File**: `src/renderer/features/todos/__tests__/delete-reparent-outdent.test.ts`

- **Update**: Test "deleting a parent with no previous active parent outdents children" (lines 79-102)
- **Change expectation**: Children should become orphaned (`parentId: null, indent: 1`) instead of outdented (`parentId: null, indent: 0`)
- **Keep**: Test for reparenting when parent found (lines 25-77)

### 1.4 Update Migration Tests

**File**: `src/renderer/features/todos/__tests__/migration.test.ts`

- **Update**: Test "reparents to null when no previous active parent exists" (lines 52-60)
- **Change expectation**: Should allow orphan (`parentId: null, indent: 1`) instead of forcing outdent
- **Keep**: All other migration tests (inferParentIds, cross-section invariant)

### 1.5 Remove Drag-Drop Utils Tests

**File**: `src/renderer/features/todos/utils/__tests__/dragDropUtils.test.ts`

- **Remove**: All tests for `fixOrphanedChildren` (lines 437-503)
- **Remove**: Import of `fixOrphanedChildren` (line 7)

### 1.6 Create New Orphaned Items Tests

**New file**: `src/renderer/features/todos/__tests__/orphaned-items.test.ts`

- Test that orphaned items (`parentId: null, indent: 1`) display as indent 0 via `deriveIndentFromParentId`
- Test that first item can be indented (creates orphan)
- Test that orphaned items persist through operations
- Test that section calculation works with orphans
- Test that drag-drop creates orphans when no parent found
- Test that delete creates orphans when no parent found

## Phase 2: Code Changes

### 2.1 Update Drag-Drop Operations

**File**: `src/renderer/features/todos/hooks/useDragReorder.ts`

**Change 1: handleDropOn** (lines 205-210)

```typescript
// Current (auto-outdents):
if (parentId == null) {
  next[movedIndex] = {
    ...next[movedIndex],
    parentId: null,
    indent: 0, // ❌ Auto-outdent
  } as any;
}

// Change to (allow orphan):
if (parentId == null) {
  next[movedIndex] = {
    ...next[movedIndex],
    parentId: null,
    indent: 1, // ✅ Allow orphan
  } as any;
}
```

**Change 2: handleDropAtEnd** (lines 290-295)

```typescript
// Current (auto-outdents):
if (parentId == null) {
  next[movedIndex] = {
    ...next[movedIndex],
    parentId: null,
    indent: 0, // ❌ Auto-outdent
  } as any;
}

// Change to (allow orphan):
if (parentId == null) {
  next[movedIndex] = {
    ...next[movedIndex],
    parentId: null,
    indent: 1, // ✅ Allow orphan
  } as any;
}
```

### 2.2 Update Delete Operations

**File**: `src/renderer/features/todos/hooks/useTodosOperations.ts`

**Change: removeTodoAt** (lines 251-254)

```typescript
// Current (auto-outdents):
const updated =
  newParentId == null
    ? outdentChildren(removed.id, next) // ❌ Auto-outdent (parentId: null, indent: 0)
    : reparentChildren(removed.id, newParentId, next);

// Change to (allow orphan):
// Note: reparentChildren(null) would set indent: 0 via deriveIndentFromParentId
// So we need to explicitly set orphan state (parentId: null, indent: 1)
const updated =
  newParentId == null
    ? next.map((t) =>
        t.parentId === removed.id
          ? { ...t, parentId: null, indent: 1 } // ✅ Allow orphan
          : t,
      )
    : reparentChildren(removed.id, newParentId, next);
```

### 2.3 Remove Keyboard Handler Restriction

**File**: `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts`

**Remove**: `hasParentAbove` function (lines 15-20)
**Remove**: Check in `handleTabKey` (line 35)
**Change**: Always allow indent when Tab pressed (no parent check)

```typescript
// Current:
function handleTabKey(...) {
  if (event.shiftKey) {
    changeIndent(id, -1);
  } else if (hasParentAbove(allTodos, index)) {  // ❌ Restriction
    changeIndent(id, +1);
  }
}

// Change to:
function handleTabKey(...) {
  if (event.shiftKey) {
    changeIndent(id, -1);
  } else {
    changeIndent(id, +1);  // ✅ Always allow
  }
}
```

### 2.4 Update Migration Logic

**File**: `src/renderer/features/todos/utils/migration.ts`

**Change: enforceParentChildInvariant** (line 80)

```typescript
// Current:
result[i] = { ...cur, parentId: newParent }; // Sets to null if no parent found
// But doesn't preserve indent - need to check

// Change to: When no parent found, allow orphan
// The current code already sets parentId: null, but we need to ensure indent is preserved
// Check if indent is being reset elsewhere - might need to preserve it explicitly
```

**Note**: Verify current behavior - migration might already allow orphans. Review lines 58-61 and 80.

### 2.5 Remove Legacy Utility

**File**: `src/renderer/features/todos/utils/dragDropUtils.ts`

- **Remove**: `fixOrphanedChildren` function (lines 125-150)
- **Remove**: Export if exported

### 2.6 Update Store Operations

**File**: `src/renderer/features/todos/store/useTodosStore.ts`

**Review**: `setIndent` (lines 223-249) - should already allow orphans (no change needed)
**Review**: `changeIndent` (lines 251-279) - should already allow orphans (no change needed)

**Change: removeTodoAt** (lines 367-370)

```typescript
// Current (auto-outdents):
const updatedTodos =
  newParentId == null
    ? outdentChildren(removed.id, next) // ❌ Auto-outdent
    : reparentChildren(removed.id, newParentId, next);

// Change to (allow orphan):
const updatedTodos =
  newParentId == null
    ? next.map((t) =>
        t.parentId === removed.id
          ? { ...t, parentId: null, indent: 1 } // ✅ Allow orphan
          : t,
      )
    : reparentChildren(removed.id, newParentId, next);
```

### 2.7 Verify Helper Functions

**File**: `src/renderer/features/todos/utils/todoUtils.ts`

- **Verify**: `reparentChildren` (lines 296-314) - ensure it handles `newParentId: null` correctly
- **Check**: When `newParentId: null`, should set `parentId: null` and preserve/derive indent from parentId

## Phase 3: Validation

### 3.1 Run Test Suite

```bash
npm test
```

- Ensure all tests pass
- Verify no regressions

### 3.2 Manual Testing Checklist

- [ ] First item can be indented (creates orphan, displays as indent 0)
- [ ] Drag-drop child item to start creates orphan (parentId: null, indent: 1)
- [ ] Delete parent with no previous parent leaves children as orphans
- [ ] Delete parent with previous parent reparents children (best parent logic works)
- [ ] Orphaned items display correctly (indent 0 visually via deriveIndentFromParentId)
- [ ] Section calculation works with orphans
- [ ] Migration from legacy data works (infers parentIds, allows orphans when no parent)

### 3.3 Code Quality Checks

```bash
npm run lint
npm run typecheck
```

- Verify no linting errors
- Verify TypeScript compiles cleanly
- Check for unused imports/variables

## Files to Modify

### Test Files (7 files)

1. `src/renderer/features/todos/hooks/__tests__/useDragReorder.test.tsx`
2. `src/renderer/features/todos/hooks/__tests__/useTodoKeyboardHandlers.test.ts`
3. `src/renderer/features/todos/__tests__/delete-reparent-outdent.test.ts`
4. `src/renderer/features/todos/__tests__/migration.test.ts`
5. `src/renderer/features/todos/utils/__tests__/dragDropUtils.test.ts`
6. `src/renderer/features/todos/__tests__/orphaned-items.test.ts` (new)

### Code Files (6 files)

1. `src/renderer/features/todos/hooks/useDragReorder.ts`
2. `src/renderer/features/todos/hooks/useTodosOperations.ts`
3. `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts`
4. `src/renderer/features/todos/utils/migration.ts` (review, may not need changes)
5. `src/renderer/features/todos/utils/dragDropUtils.ts`
6. `src/renderer/features/todos/store/useTodosStore.ts` (review)

## Implementation Order

1. **Tests First**: Update/create tests to match new behavior
2. **Code Changes**: Implement code changes to match tests
3. **Validation**: Run tests and verify behavior

## Key Changes Summary

| Location              | Current Behavior           | New Behavior                  |
| --------------------- | -------------------------- | ----------------------------- |
| Drag-drop (no parent) | Auto-outdent (`indent: 0`) | Allow orphan (`indent: 1`)    |
| Delete (no parent)    | Auto-outdent children      | Allow orphan children         |
| Keyboard (first item) | Prevent indent             | Allow indent (creates orphan) |
| Migration (no parent) | Review needed              | Allow orphan                  |

## Estimated Impact

- **LOC Removed**: ~50 lines (auto-outdent logic, hasParentAbove check, fixOrphanedChildren)
- **LOC Modified**: ~20 lines (change auto-outdent to allow orphan)
- **LOC Added**: ~50 lines (new tests)
- **Net**: ~0 LOC change, but simpler logic
- **Complexity**: Reduced (no auto-outdent logic needed)
