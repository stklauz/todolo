# Orphaned Items Analysis: Simplification Opportunities

## Current Behavior

### The Issue

1. **Can't indent first item**: Keyboard handler prevents indenting the first item (via `hasParentAbove` check in `useTodoKeyboardHandlers.ts`)
2. **Drag-drop can create orphans**: When dragging a child item, if no valid parent is found, it becomes orphaned (`parentId: null` but might have `indent: 1`)

### What Are Orphaned Items?

An orphaned item has:

- `parentId: null` (or undefined)
- But `indent: 1` (visual indent without a parent)
- OR: `parentId` pointing to a non-existent/invalid parent

### Concrete Examples

**Starting State:**

```
A
 - 1
 - 2
B
 - 3
```

#### Strategy A: Orphaned Items ALLOWED (Current After Drag-Drop)

**Example 1: Drag 1 above A**

- Drag 1 (child of A) to position above A
- Result: 1 becomes orphaned (parentId: null, indent: 1)
- Display:

```
- 1    (orphaned, displays as indent 0 via deriveIndentFromParentId)
A
 - 2
B
 - 3
```

**Example 2: Delete A**

- Delete A (parent of 1 and 2)
- Result: 1 and 2 become orphaned (parentId: null, indent: 1)
- Display:

```
- 1    (orphaned)
- 2    (orphaned)
B
 - 3
```

**Example 3: Drag 3 above 1**

- Drag 3 (child of B) to position above 1
- Result: 3 becomes child of A (finds nearest previous parent)
- Display:

```
A
 - 3
 - 1
 - 2
B
```

**Example 4: Delete B**

- Delete B (parent of 3)
- Result: 3 becomes child of A (reparented to nearest previous active parent)
- Display:

```
A
 - 1
 - 2
 - 3
```

#### Strategy B: No Orphaned Items (Auto-Outdent)

**Example 1: Drag 1 above A**

- Drag 1 (child of A) to position above A
- Result: 1 becomes top-level (parentId: null, indent: 0) - auto-outdented
- Display:

```
1     (top-level, no indent)
A
 - 2
B
 - 3
```

**Example 2: Delete A**

- Delete A (parent of 1 and 2)
- Result: 1 and 2 become top-level (parentId: null, indent: 0) - auto-outdented
- Display:

```
1     (top-level)
2     (top-level)
B
 - 3
```

**Example 3: Drag 3 above 1**

- Drag 3 (child of B) to position above 1
- Result: 3 becomes child of A (finds nearest previous parent)
- Display:

```
A
 - 3
 - 1
 - 2
B
```

**Example 4: Delete B**

- Delete B (parent of 3)
- Result: 3 becomes child of A (reparented to nearest previous active parent)
- Display:

```
A
 - 1
 - 2
 - 3
```

### Key Difference

**Orphaned Allowed (Strategy A):**

- Items can have `parentId: null` but `indent: 1` (orphaned state)
- Display logic (`deriveIndentFromParentId`) shows them as indent 0
- No automatic outdenting when parent is removed
- Simpler: Just move/delete, no fixup logic

**No Orphaned (Strategy B):**

- Items with `parentId: null` must have `indent: 0`
- When parent removed, children are auto-outdented (not orphaned)
- More logic: Need to detect orphans and fix them
- More predictable UI: indent always matches parentId state

## Current Logic Analysis

The codebase has **two types of logic**:

1. **"Find Best Parent" Logic**: When possible, tries to find and assign the nearest previous active parent
   - Drag-drop: Finds parent when moving children (lines 162-218, 276-304 in `useDragReorder.ts`)
   - Delete: Reparents children to nearest previous parent (lines 240-255 in `useTodosOperations.ts`)
   - Migration: Reparents to nearest previous active parent (lines 39-94 in `migration.ts`)

2. **Orphan-Fixing Logic**: When no parent found, either:
   - Creates orphan (`parentId: null, indent: 1`) - in indent operations
   - Auto-outdents (`parentId: null, indent: 0`) - in drag-drop and delete operations

### Current Behavior by Operation

#### 1. Drag-Drop Operations (`useDragReorder.ts`)

- **Lines 162-218**: When moving a child, searches backward for a valid parent
- **Lines 276-304**: Same logic when dropping at end of section
- **If parent found**: Assigns parentId
- **If no parent found**: Sets `parentId: null, indent: 0` (auto-outdents)

#### 2. Indent Operations (`useTodosOperations.ts`)

- **Lines 137-143**: `computeParentForIndentChange` searches backward for parent
- **If parent found**: Assigns parentId
- **If no parent found**: Allows orphan (`parentId: null, indent: clamped`) - **THIS CREATES ORPHANS**

#### 3. Delete Operations (`useTodosOperations.ts`)

- **Lines 240-255**: When deleting a parent, reparents children to nearest previous parent
- **If parent found**: Reparents children
- **If no parent found**: Outdents children (`parentId: null, indent: 0`)

#### 4. Migration (`migration.ts`)

- **Lines 39-94**: `enforceParentChildInvariant` fixes orphaned children
- Reparents to nearest previous active parent, or null if none found

#### 5. Legacy Utility (`dragDropUtils.ts`)

- **Lines 128-150**: `fixOrphanedChildren` - **OUTDATED** - uses indent-based logic instead of parentId

## Strategy Options

Based on the examples, we need to decide:

1. **Should we keep "find best parent" logic?** (reparenting when possible)
2. **What should happen when no parent is found?** (orphaned vs auto-outdent)

### Option 1: Keep "Find Best Parent" + Auto-Outdent (No Orphans, Matches Strategy B)

**Behavior**: When parent removed/moved, try to find best parent. If none found, auto-outdent (indent: 0).

**What We'd Need to Change:**

#### 1. Indent Operations

- **In `setIndent`/`changeIndent`**: Reject indent if no parent found (keep current check)
- **Change**: Instead of allowing orphan, reject the operation
- **Keep**: `hasParentAbove` check in keyboard handler

#### 2. Drag-Drop Operations

- **Keep**: "Find best parent" logic (lines 162-218, 276-304)
- **Keep**: Auto-outdent when no parent found (`parentId: null, indent: 0`)

#### 3. Delete Operations

- **Keep**: Reparenting logic (lines 240-255)
- **Keep**: Auto-outdent when no parent found

#### 4. Migration

- **Keep**: Reparenting to nearest previous active parent
- **Keep**: Auto-outdent when no parent found

### Complexity

- **Keeps**: ~150 LOC of "find best parent" logic
- **Adds**: ~50 LOC for indent validation
- **Net**: **+50 LOC** (more complex)
- **Benefit**: More predictable UI (indent always matches parentId)

### Examples Match Strategy B (from above)

### Option 2: Keep "Find Best Parent" + Allow Orphans (Matches Strategy A)

**Behavior**: Try to find best parent when possible. If none found, allow orphan (don't auto-outdent). This matches Strategy A from examples.

**What We'd Keep/Change:**

#### 1. Drag-Drop Operations

- **Keep**: "Find best parent" logic (lines 162-218, 276-304)
- **Change**: If no parent found, allow orphan (`parentId: null, indent: 1`) instead of auto-outdent

#### 2. Indent Operations

- **Keep**: Parent search in `computeParentForIndentChange`
- **Keep**: Allow orphan when no parent found (current behavior)
- **Remove**: `hasParentAbove` check in keyboard handler (allow first item to indent)

#### 3. Delete Operations

- **Keep**: Reparenting logic (lines 240-255)
- **Change**: If no parent found, allow orphan (`parentId: null, indent: 1`) instead of auto-outdent

#### 4. Migration Logic

- **Keep**: Reparenting to nearest previous active parent
- **Change**: If no parent found, allow orphan instead of auto-outdent

#### 5. Remove Legacy Utility

- **Remove**: `fixOrphanedChildren` function entirely (outdated)

### Complexity

- **Keeps**: ~150 LOC of "find best parent" logic
- **Removes**: ~50 LOC of auto-outdent logic
- **Net**: **-50 LOC** (slightly simpler)
- **Benefit**: Keeps intelligent reparenting, but allows orphans when no parent found

### Examples Match Strategy A (from above)

- Examples 1-2: Items become orphaned (no parent to find)
- Examples 3-4: Items reparented to A (best parent found)

## Comparison

| Aspect                   | Option 1: Keep Best Parent + Auto-Outdent (Strategy B) | Option 2: Keep Best Parent + Allow Orphans (Strategy A) |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| **LOC Change**           | +50 LOC                                                | -50 LOC                                                 |
| **Complexity**           | Higher (validation + reparenting)                      | Lower (reparenting only, no auto-outdent)               |
| **Predictability**       | High (indent always matches parentId)                  | Medium (orphans display as indent 0)                    |
| **User Experience**      | Can't indent first item                                | Can indent first item (orphan)                          |
| **Logic Complexity**     | More complex                                           | Simpler                                                 |
| **"Best Parent" Logic**  | ✅ Kept                                                | ✅ Kept                                                 |
| **Orphan Handling**      | Auto-outdent (no orphans)                              | Allow orphan                                            |
| **When No Parent Found** | Auto-outdent to indent 0                               | Allow orphan (parentId: null, indent: 1)                |

## Key Insight

**Both options keep "find best parent" logic!** The only difference is what happens when no parent is found:

- **Option 1 (Strategy B)**: Auto-outdent (indent: 0) - no orphans allowed
- **Option 2 (Strategy A)**: Allow orphan (parentId: null, indent: 1) - orphans allowed

Both strategies show reparenting in Examples 3-4, demonstrating that "find best parent" logic is preserved in both.

## Recommendation

Based on the examples and complexity analysis:

**Option 2 (Keep Best Parent + Allow Orphans)** is simpler:

- Removes code (-50 LOC vs +50 LOC)
- More user-friendly (can indent first item)
- Simpler (no auto-outdent logic needed)
- UI already handles orphans correctly via `deriveIndentFromParentId`

**Option 1 (Keep Best Parent + Auto-Outdent)** is more predictable:

- No orphan states (indent always matches parentId)
- More predictable UI behavior
- But adds complexity (+50 LOC) and prevents first item indentation

## Recommendation: **Option 2 (Strategy A)**

Keep "find best parent" logic, but allow orphans when no parent found. This matches the examples you provided and simplifies the codebase.

## Next Steps

Once a strategy is chosen, we can create a detailed implementation plan with:

1. Specific code changes per file
2. Test updates needed
3. Validation steps
