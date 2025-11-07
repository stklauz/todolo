# Implementation Plan: Text Editor Capabilities - Enter Split & Backspace Merge

**Status**: ✅ Completed  
**Priority**: P1 - Feature Development  
**Created**: 2025-01-27  
**Last Updated**: 2025-01-27 (Implementation Complete)  
**Features**:

- Split todo content on Enter key press based on cursor position
- Merge todos on Backspace at start of todo (reverse of split)

**Decisions Finalized:**

- ✅ Focus always moves to new todo after split
- ✅ Whitespace preserved (trimming optional if reduces complexity)
- ✅ Empty todos kept after split (Option 1)
- ✅ Backspace at start merges with previous todo (reverse of split)

---

## Problem Statement

Currently, when a user presses Enter in a todo item, a new empty todo is always created below, regardless of where the cursor is positioned within the text. Additionally, there's no way to merge todos back together, making it difficult to undo splits or combine related items.

**Current Behavior:**

- User presses Enter → New empty todo created below (always)
- Original todo content remains unchanged
- Focus moves to the new empty todo
- User presses Backspace at start → Either deletes empty todo or outdents (no merge capability)

**User Need:**
Users want text editor-like capabilities:

- **Split**: Split todo content at the cursor position when pressing Enter
- **Merge**: Merge current todo with previous one when pressing Backspace at the start
- This allows quick reorganization and undoing of splits

---

## Solution Overview

### Enter Key: Split Content

Enhance the Enter key handler to split todo content based on cursor position:

1. **Cursor at end of text**: Create new empty todo below (preserve current behavior)
2. **Cursor in middle of text**: Split content - left part stays in current todo, right part moves to new todo below
3. **Cursor at start of text**: Current todo becomes empty, original content moves to new todo below

### Backspace Key: Merge Content (Reverse Operation)

Enhance the Backspace key handler to merge todos when cursor is at the start:

1. **Cursor at start of non-empty todo**: Merge current todo content with previous todo above
2. **Cursor at start of empty todo**: Keep current behavior (delete/outdent)
3. **Cursor in middle/end of text**: Normal text editing (don't intercept)

### Behavior Details

#### Scenario 1: Cursor at End

```
Before: "a big box of chocolates|"  (cursor at end, marked by |)
After:  "a big box of chocolates"
        "|"  (new empty todo, cursor at start)
```

#### Scenario 2: Cursor in Middle

```
Before: "a big box |of chocolates"  (cursor in middle)
After:  "a big box "
        "|of chocolates"  (new todo with content, cursor at start)
```

#### Scenario 3: Cursor at Start

```
Before: "|a big box of chocolates"  (cursor at start)
After:  ""  (current todo becomes empty)
        "|a big box of chocolates"  (new todo below with original content, cursor at start)
```

### Backspace Merge Behavior Details

#### Scenario 1: Backspace at Start of Non-Empty Todo

```
Before: "hello world"
        "|chocolates"  (cursor at start of second todo)
After:  "hello world|chocolates"  (merged, cursor at junction point)
```

#### Scenario 2: Backspace at Start of Empty Todo

```
Before: "hello world"
        "|"  (empty todo, cursor at start)
After:  "hello world"  (empty todo deleted, focus on previous)
```

_(Keeps current behavior - this is already implemented)_

#### Scenario 3: Backspace in Middle/End of Text

```
Before: "hello |world"  (cursor in middle)
After:  "hello |rld"  (normal text editing - deletes character)
```

_(Normal browser behavior - don't intercept)_

---

## Acceptance Criteria

### Functional Requirements

1. **Enter at end of text**
   - ✅ Creates new empty todo below current todo
   - ✅ Focus moves to new empty todo
   - ✅ Original todo content remains unchanged
   - ✅ New todo inherits same indent level as current todo

2. **Enter in middle of text**
   - ✅ Current todo content is split at cursor position
   - ✅ Text before cursor stays in current todo (whitespace preserved)
   - ✅ Text after cursor moves to new todo (whitespace preserved)
   - ✅ Focus moves to start of new todo
   - ✅ New todo inherits same indent level as current todo

3. **Enter at start of text**
   - ✅ Current todo becomes empty
   - ✅ Original content moves to new todo below
   - ✅ Focus moves to new todo (with content)
   - ✅ New todo inherits same indent level as current todo

4. **Empty/whitespace-only todos**
   - ✅ Enter on empty todo does nothing (preserve current behavior)
   - ✅ Enter on whitespace-only todo does nothing (preserve current behavior)

5. **Edge Cases**
   - ✅ Works correctly with todos that have parent-child relationships
   - ✅ New todos inherit correct parentId when splitting
   - ✅ Works correctly with filtered views (completed items hidden)
   - ✅ Cursor positioning handles emojis and combining characters correctly

### Backspace Merge Requirements

1. **Backspace at start of non-empty todo**
   - ✅ Merges current todo content with previous todo above
   - ✅ Current todo is removed after merge
   - ✅ Focus moves to previous todo at the junction point (where content was merged)
   - ✅ Cursor positioned at the end of previous todo's original content

2. **Backspace at start of empty todo**
   - ✅ Keeps current behavior (delete/outdent)
   - ✅ No change to existing functionality

3. **Backspace in middle/end of text**
   - ✅ Normal text editing behavior (don't intercept)
   - ✅ Let browser handle character deletion

4. **Edge Cases for Merge**
   - ✅ Works with first todo (no previous todo to merge with - do nothing or delete if empty)
   - ✅ Works with todos that have parent-child relationships
   - ✅ Handles merge across filtered views correctly
   - ✅ Works with emojis and combining characters
   - ✅ Preserves whitespace when merging

### Non-Functional Requirements

1. **Performance**: No noticeable delay when splitting todos
2. **Accessibility**: Focus management works correctly for screen readers
3. **Consistency**: Behavior matches user expectations from text editors
4. **Backward Compatibility**: Existing Enter key behavior is preserved for end-of-text case

---

## Technical Approach

### Architecture Overview

The implementation requires changes to:

1. **Keyboard Handler**: Update `handleEnterKey` to detect cursor position and split content
2. **Focus Management**: Ensure cursor is positioned correctly in new todos (at start, not end)
3. **Todo Operations**: Leverage existing `updateTodo` and `insertTodoBelow` functions

### Key Implementation Details

#### 1. Cursor Position Detection

- Use `event.currentTarget.selectionStart` to get cursor position
- This is a standard DOM API available on textarea elements

#### 2. Content Splitting Logic

```typescript
const cursorPos = event.currentTarget.selectionStart;
const text = event.currentTarget.value;

// Split at cursor (preserve whitespace for simplicity)
const leftContent = text.slice(0, cursorPos);
const rightContent = text.slice(cursorPos);

// Note: If trimming reduces complexity in edge cases, we can add:
// const leftContent = text.slice(0, cursorPos).trimEnd();
// const rightContent = text.slice(cursorPos).trimStart();
```

#### 3. Behavior Decision Tree

```
If text.trim().length === 0:
  → Do nothing (preserve current behavior)

Else if cursorPos === 0:
  → Current todo becomes empty
  → New todo gets original content
  → Focus moves to new todo (at start)

Else if cursorPos === text.length:
  → Current todo unchanged
  → New empty todo created
  → Focus moves to new todo (at start)

Else (cursor in middle):
  → Current todo gets leftContent
  → New todo gets rightContent
  → Focus moves to start of new todo
```

**Note**: Focus always moves to the new todo for consistency and simpler implementation.

#### 4. Focus Management Enhancement

- Current `focusTodo` always places cursor at end
- Need to enhance to support cursor at start for split scenarios
- Use `setSelectionRange(0, 0)` to position cursor at start
- For split scenarios, always focus new todo at start (consistent behavior)

#### 5. Observability (Development Rules Requirement)

- Add debug logging for key decision points in Enter handler
- Log which branch was taken (start/middle/end cursor position)
- Log affected todo IDs and indices
- Log content lengths (truncated) for troubleshooting
- Use `debugLogger.log('info', ...)` from `../../../utils/debug`
- This meets the "Add basic observability (logs/metrics) for key paths" requirement

**Example logging:**

```typescript
import { debugLogger } from '../../../utils/debug';

// In handleEnterKey:
debugLogger.log('info', 'Enter key: split todo', {
  branch: 'start' | 'middle' | 'end',
  todoId: cur.id,
  cursorPos,
  newTodoId,
  leftContent: leftContent.slice(0, 50), // Truncate for logs
  rightContent: rightContent.slice(0, 50),
});
```

---

## Implementation Phases

### Phase 1: Cursor Utilities (30 min)

**Goal**: Create helper utilities for cursor position detection and manipulation

**File**: `src/renderer/features/todos/utils/cursorUtils.ts` (new file)

**Functions to create:**

- `getCursorPosition(el: HTMLTextAreaElement): number`
- `isCursorAtStart(el: HTMLTextAreaElement): boolean`
- `isCursorAtEnd(el: HTMLTextAreaElement): boolean`

**Tests**: Unit tests for each utility function

---

### Phase 2: Enhance Focus Management (45 min)

**Goal**: Extend focus system to support cursor positioning at start or end

**Files to modify:**

- `src/renderer/features/todos/hooks/useTodoFocus.ts`
- `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts`

**Changes:**

1. Update `focusTodo` to accept optional `position: 'start' | 'end'` parameter
2. Update `focusNextIdRef` to store position information
3. Update `useTodoFocusEffect` to respect position when setting cursor
4. Update all call sites to use new signature (default to 'end' for backward compatibility)

**Tests**: Update existing tests, add tests for start/end positioning

---

### Phase 3: Update Enter Key Handler (1 hour)

**Goal**: Implement content splitting logic in Enter key handler

**Files to modify:**

- `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts`
- `src/renderer/features/todos/components/TodoList/TodoList.tsx`

**Changes:**

1. Update `UseTodoKeyboardHandlersProps` interface to include `updateTodo`
2. Modify `handleEnterKey` to:
   - Get cursor position from textarea
   - Split content based on cursor position
   - Update current todo with left content (if needed)
   - Create new todo with right content
   - Focus new todo with cursor at start (for split cases)
   - Add debug logging for decision points (branch taken: start/middle/end, indices/ids affected)
3. Pass `updateTodo` from `TodoList` to `useTodoKeyboardHandlers`
4. Import `debugLogger` from `../../../utils/debug` and add observability logs

**Observability**: Add debug logs for key decision points:

```typescript
debugLogger.log('info', 'Enter key: split todo', {
  branch: 'start' | 'middle' | 'end',
  todoId: cur.id,
  cursorPos,
  newTodoId,
  leftContent: leftContent.slice(0, 50), // Truncate for logs
  rightContent: rightContent.slice(0, 50),
});
```

**Tests**:

- Unit tests for `handleEnterKey` with different cursor positions
- Integration tests for split scenarios
- E2E tests for user workflow

---

### Phase 3b: Update Backspace Key Handler (1 hour)

**Goal**: Implement content merging logic in Backspace key handler (reverse of split)

**Files to modify:**

- `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts`

**Changes:**

1. Modify `handleBackspaceKey` to:
   - Check if cursor is at start of text (using `isCursorAtStart`)
   - If cursor is at start AND todo has content:
     - Find previous todo
     - Merge current todo content with previous todo
     - Remove current todo
     - Focus previous todo with cursor at junction point
   - If cursor is at start AND todo is empty:
     - Keep current behavior (delete/outdent logic)
   - If cursor is in middle/end:
     - Don't intercept (let browser handle normal text editing)
2. Add debug logging for merge operations

**Merge Logic:**

```typescript
// When cursor at start of non-empty todo:
const prevTodo = allTodos[index - 1];
if (prevTodo) {
  const mergedText = prevTodo.text + cur.text;
  updateTodo(prevTodo.id, mergedText);
  removeTodoAt(index);
  focusTodo(prevTodo.id, 'end'); // Focus at end of previous content
}
```

**Edge Cases:**

- First todo (index === 0): Can't merge, do nothing (or keep delete behavior if empty)
- Previous todo might be in different section (completed vs active): Handle appropriately
- Parent-child relationships: Consider whether merge should preserve hierarchy

**Observability**: Add debug logs:

```typescript
debugLogger.log('info', 'Backspace key: merge todo', {
  currentTodoId: cur.id,
  previousTodoId: prevTodo.id,
  mergedContent: mergedText.slice(0, 50),
  cursorPos,
});
```

**Tests**:

- Unit tests for `handleBackspaceKey` merge scenarios
- Test merge with previous todo
- Test merge with first todo (should not merge)
- Test merge preserves whitespace
- Test merge with emojis
- Integration tests for merge workflow
- E2E tests for user workflow

---

### Phase 4: Testing & Validation (2 hours)

**Goal**: Comprehensive test coverage and manual validation

**Tasks:**

1. Write unit tests for cursor utilities
2. Write unit tests for updated Enter handler (split)
3. Write unit tests for updated Backspace handler (merge)
4. Write integration tests for split scenarios
5. Write integration tests for merge scenarios
6. Write E2E tests for split workflow
7. Write E2E tests for merge workflow
8. Write E2E tests for split-merge roundtrip
9. Update existing E2E tests
10. Manual testing checklist
11. Edge case validation

---

## Testing Strategy

### Unit Tests

**File**: `src/renderer/features/todos/utils/__tests__/cursorUtils.test.ts` (new)

- Test `getCursorPosition` returns correct position
- Test `isCursorAtStart` detects start position correctly
- Test `isCursorAtEnd` detects end position correctly
- Test with empty textarea
- Test with emojis (e.g., "Hello 👋 world")
- Test with accented characters (e.g., "Café résumé")
- Test with combining characters

**File**: `src/renderer/features/todos/hooks/__tests__/useTodoKeyboardHandlers.test.ts`

**Enter Key Tests:**

- Test Enter at end creates empty todo (existing test, should still pass)
- Test Enter in middle splits content correctly
- Test Enter at start moves content to new todo
- Test Enter on empty todo does nothing (existing test, should still pass)
- Test whitespace preservation in split scenarios
- Test focus positioning (start vs end)
- Test with emojis: "Hello 👋 world" split at emoji boundary
- Test with accented characters: "Café résumé" split correctly

**Backspace Key Tests:**

- Test Backspace at start of non-empty todo merges with previous
- Test Backspace at start of empty todo keeps current behavior (delete/outdent)
- Test Backspace in middle of text does nothing (normal editing)
- Test Backspace at start of first todo does nothing (no previous to merge)
- Test merge preserves whitespace correctly
- Test merge with emojis: "Hello " + "👋 world" → "Hello 👋 world"
- Test focus positioning after merge (cursor at junction point)
- Test merge removes current todo correctly
- Test merge works with parent-child relationships

### Integration Tests

**File**: `src/renderer/__tests__/e2e/todo-keyboard.test.tsx`

**Enter Key E2E Tests:**

- Test full workflow: user types, moves cursor, presses Enter
- Test split preserves parent-child relationships
- Test split works with filtered views
- Test multiple consecutive splits

**Backspace Key E2E Tests:**

- Test full workflow: user splits with Enter, then merges with Backspace
- Test merge with previous todo above
- Test merge doesn't work on first todo
- Test merge works with filtered views
- Test split and merge roundtrip (split then merge = original content)
- Test multiple consecutive merges

### Manual Testing Checklist

- [ ] Enter at end creates empty todo below
- [ ] Enter in middle splits content correctly
- [ ] Enter at start moves content to new todo
- [ ] Cursor positioning is correct after split
- [ ] Whitespace handling (trailing/leading) works correctly
- [ ] Works with indented todos (parent-child relationships)
- [ ] Works when completed items are hidden
- [ ] Works with emojis (e.g., "Hello 👋 world")
- [ ] Works with accented characters (e.g., "Café résumé")
- [ ] Works with combining characters
- [ ] Empty todo Enter behavior unchanged
- [ ] Focus management works correctly

**Backspace Merge Manual Tests:**

- [ ] Backspace at start merges with previous todo
- [ ] Cursor positioning is correct after merge (at junction point)
- [ ] Merged content is correct (previous + current)
- [ ] Current todo is removed after merge
- [ ] Backspace at start of empty todo still deletes/outdents
- [ ] Backspace in middle/end does normal text editing
- [ ] Backspace on first todo does nothing (no merge)
- [ ] Works with indented todos (parent-child relationships)
- [ ] Works when completed items are hidden
- [ ] Works with emojis (e.g., "Hello " + "👋 world")
- [ ] Works with accented characters
- [ ] Split and merge roundtrip works (split then merge = original)

---

## Files to Modify

### New Files (1)

1. `src/renderer/features/todos/utils/cursorUtils.ts` - Cursor position utilities

### Modified Files (3)

1. `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts` - Enter handler (split) and Backspace handler (merge) logic
2. `src/renderer/features/todos/hooks/useTodoFocus.ts` - Focus positioning
3. `src/renderer/features/todos/components/TodoList/TodoList.tsx` - Pass updateTodo

### Test Files (3 new, 1 updated)

1. `src/renderer/features/todos/utils/__tests__/cursorUtils.test.ts` (new)
2. `src/renderer/features/todos/hooks/__tests__/useTodoKeyboardHandlers.test.ts` (update - add split and merge tests)
3. `src/renderer/__tests__/e2e/todo-keyboard.test.tsx` (update - add split and merge E2E tests)
4. `src/renderer/features/todos/hooks/__tests__/useTodoFocus.test.ts` (new, if needed)

---

## Risks & Concerns

### Risk 1: Focus Management Complexity

**Risk**: Enhanced focus system might interfere with existing focus behavior  
**Mitigation**:

- Default to 'end' position for backward compatibility
- Extensive testing of existing focus scenarios
- Keep focus logic isolated in `useTodoFocus` hook

### Risk 2: Cursor Position Accuracy

**Risk**: Cursor position might be incorrect with emojis, combining characters, or after DOM updates  
**Mitigation**:

- Use standard DOM APIs (`selectionStart`) which handle UTF-16 correctly (JavaScript string encoding)
- Test with various character sets (emojis, accented characters, combining characters)
- Start with JSDOM + typical emojis for validation
- Note: For perfect grapheme handling, may need a grapheme splitter library later, but start simple
- Ensure DOM is stable before reading cursor position

### Risk 3: State Update Timing

**Risk**: React state updates might cause cursor position to be lost  
**Mitigation**:

- Use `focusTodo` with position parameter (async focus scheduling)
- Ensure state updates complete before focusing
- Test with React 18 concurrent features if applicable

### Risk 4: Parent-Child Relationships

**Risk**: Split todos might break parent-child relationships  
**Mitigation**:

- New todos inherit `parentId` from current todo (via `insertTodoBelow`)
- Test with indented todos thoroughly
- Verify section grouping still works correctly

### Risk 5: Performance with Large Content

**Risk**: Splitting large todos might cause performance issues  
**Mitigation**:

- String operations are fast in JavaScript
- No DOM manipulation in hot path
- Profile if needed, but unlikely to be an issue

### Risk 6: User Experience Confusion

**Risk**: Users might not expect split behavior, especially at start  
**Mitigation**:

- Behavior is intuitive (matches text editor expectations)
- Clear acceptance criteria and testing

### Risk 7: Backspace Merge Complexity

**Risk**: Merge logic might have edge cases with parent-child relationships or filtered views  
**Mitigation**:

- Keep merge logic simple: only merge when cursor at start and todo has content
- Test thoroughly with hierarchy scenarios
- Consider: should merge respect parent-child relationships? (Recommendation: merge only if both todos have same parent/indent level, or always merge and let hierarchy be inherited from previous todo)
- Test with filtered views to ensure correct behavior

---

## Open Questions

1. **Whitespace Handling**: Should we trim whitespace when splitting, or preserve exact content?
   - **Decision**: Preserve whitespace for now (keep it simple)
   - **Note**: If trimming reduces complexity in implementation, that's acceptable
   - **Rationale**: Trimming would require additional logic (`trimEnd()` and `trimStart()`), but may simplify edge cases

2. **Empty Todo After Split**: If split results in empty current todo, should we keep it or remove it?
   - **Decision**: **Option 1 - Keep Empty Todo** (finalized)
   - **Rationale**: Lowest complexity, consistent with system behavior, users can delete with Backspace if needed
   - **Current System Behavior**:
     - Empty todos are allowed and persist in the system
     - System ensures at least one empty todo exists when there are no active todos
     - Users can delete empty todos with Backspace
     - Enter key does nothing on empty todos (prevented by guard clause)

3. **Backspace Merge with First Todo**: What should happen when Backspace is pressed at start of first todo?
   - **Decision**: Do nothing (no previous todo to merge with). Keep current behavior if empty (can't delete last todo).
   - **Rationale**: Consistent with text editor behavior - can't merge with nothing

4. **Backspace Merge with Different Hierarchy Levels**: Should merge work between todos with different indent levels?
   - **Decision**: **Allow merge regardless of hierarchy** (simpler, more intuitive)
   - **Alternative Considered**: Only merge if same indent level
   - **Rationale**: Users might want to merge across hierarchy levels; simpler logic; hierarchy can be adjusted after merge if needed

5. **Undo/Redo**: How does this interact with undo/redo functionality?
   - **Status**: Need to verify if undo/redo is implemented. If yes, ensure split and merge operations are undoable.

6. **Accessibility**: How should screen readers announce the split/merge?
   - **Status**: Should test with screen readers. Focus movement should be sufficient, but may need ARIA announcements.

---

## Empty Todo Handling Options (After Split)

When a split occurs and the current todo becomes empty, we need to decide how to handle it. Here are the options with complexity analysis:

### Option 1: Keep Empty Todo (Simplest)

**Behavior**: Leave the empty todo in place after split

**Pros:**

- ✅ Simplest implementation (no additional logic needed)
- ✅ Consistent with current system behavior (empty todos are allowed)
- ✅ User can delete it with Backspace if they want
- ✅ Allows user to continue editing in that position if desired
- ✅ No edge cases to handle

**Cons:**

- ❌ May accumulate empty todos if user does multiple splits
- ❌ User needs to manually clean up empty todos

**Complexity**: **LOW** (no code changes needed)

- Just update current todo to empty string
- Let existing empty todo handling work as-is

**Code Impact**: None (current behavior)

---

### Option 2: Remove Empty Todo Automatically

**Behavior**: Automatically remove the empty todo immediately after split

**Pros:**

- ✅ Cleaner UI (no empty todos left behind)
- ✅ Prevents accumulation of empty todos
- ✅ Matches user expectation in some text editors

**Cons:**

- ❌ More complex logic needed
- ❌ Need to handle focus carefully (todo index shifts)
- ❌ Need to handle edge case: what if it's the only todo?
- ❌ May be unexpected behavior (user might want to keep editing there)
- ❌ Need to handle parent-child relationships (if todo has children)

**Complexity**: **MEDIUM**

- Need to call `removeTodoAt(index)` after split
- Need to ensure focus goes to correct todo (index may have shifted)
- Need to handle case where current todo is the only todo
- Need to handle case where current todo has children (shouldn't remove)

**Code Impact**:

```typescript
// After split at start:
if (cursorPos === 0) {
  updateTodo(cur.id, ''); // Clear current
  const newId = insertTodoBelow(index, text); // Create new with content
  removeTodoAt(index); // Remove now-empty current todo
  focusTodo(newId); // Focus new todo
}
// But wait - removeTodoAt shifts indices! Need to account for this.
```

**Edge Cases to Handle:**

- Empty todo is the only todo → Can't remove (system needs at least one)
- Empty todo has children → Shouldn't remove (would orphan children)
- Empty todo is first in a filtered view → Need correct index translation

---

### Option 3: Remove Only If It's Not The Last Empty Todo

**Behavior**: Remove empty todo after split, but keep at least one empty todo in the list

**Pros:**

- ✅ Prevents accumulation while maintaining system invariant (at least one empty todo)
- ✅ Cleaner than Option 1, but safer than Option 2

**Cons:**

- ❌ More complex than Option 1
- ❌ Need to check if other empty todos exist
- ❌ Still need to handle focus and index shifts
- ❌ Still need to handle parent-child relationships

**Complexity**: **MEDIUM-HIGH**

- Need to count empty todos before removal
- Need to check if it's safe to remove (no children, not last empty)
- Need to handle index shifts after removal
- More conditional logic than Option 2

**Code Impact**:

```typescript
// After split:
const isEmptyAfterSplit = leftContent.trim().length === 0;
if (isEmptyAfterSplit) {
  const emptyCount = allTodos.filter((t) => t.text.trim().length === 0).length;
  const hasChildren = allTodos.some((t) => t.parentId === cur.id);

  if (emptyCount > 1 && !hasChildren) {
    // Safe to remove - but need to handle index shift!
    // Focus logic becomes more complex
  }
}
```

---

### Option 4: Remove Only If No Children (Hierarchy-Aware)

**Behavior**: Remove empty todo after split, but only if it has no children

**Pros:**

- ✅ Preserves parent-child relationships
- ✅ Prevents orphaned children
- ✅ Removes empty todos when safe

**Cons:**

- ❌ Most complex option
- ❌ Need to check for children
- ❌ Need to handle all edge cases from Option 2
- ❌ Still need index shift handling

**Complexity**: **HIGH**

- All complexity of Option 2
- Plus need to check for children: `allTodos.some(t => t.parentId === cur.id)`
- More conditional branches

---

### ✅ **Decision: Option 1 (Keep Empty Todo)** - FINALIZED

**Rationale:**

1. **Lowest Complexity**: No additional code or edge cases
2. **Consistent with System**: Empty todos are already part of the system design
3. **User Control**: Users can delete empty todos with Backspace (existing functionality)
4. **Predictable**: No surprising removals that might confuse users
5. **Less Risk**: No index shift issues, no focus management complexity
6. **Iterative**: Can always add removal logic later if needed (YAGNI principle)

**Implementation**:

- Just update current todo to empty string (if cursor at start)
- Let existing empty todo handling work as-is
- Focus moves to new todo (consistent behavior)
- No removal logic needed

**If Empty Todos Become A Problem Later:**

- Can add cleanup logic in a separate feature
- Can add auto-removal on blur if empty
- Can add batch cleanup option
- But don't add complexity now if not needed

---

## Implementation Order

1. **Phase 1**: Create cursor utilities + tests
2. **Phase 2**: Enhance focus management + tests
3. **Phase 3**: Update Enter handler (split) + tests
4. **Phase 3b**: Update Backspace handler (merge) + tests
5. **Phase 4**: Integration tests + manual validation
6. **Review**: Code review and adjustments
7. **Merge**: Deploy to main branch

**Note**: Phase 3 and 3b can be done together since they share similar logic and dependencies.

---

## Timeline Estimate

| Phase     | Task                      | Time           | Risk           |
| --------- | ------------------------- | -------------- | -------------- |
| 1         | Cursor utilities          | 30 min         | Low            |
| 2         | Focus management          | 45 min         | Medium         |
| 3         | Enter handler (split)     | 1 hour         | Low            |
| 3b        | Backspace handler (merge) | 1 hour         | Low            |
| 4         | Testing & validation      | 2 hours        | Low            |
| **Total** |                           | **5.25 hours** | **Low-Medium** |

**Note**: Times are estimates. Backspace merge is similar complexity to Enter split.

**Note**: This is a focused feature with clear requirements. Risk is primarily in focus management complexity, but existing infrastructure supports the needed changes.

---

## Success Metrics

- ✅ All acceptance criteria met
- ✅ All tests passing (>80% coverage for new code)
- ✅ No regressions in existing Enter key behavior
- ✅ Manual testing checklist completed
- ✅ Code review approved
- ✅ Linting and type checking passing

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Clarify open questions** if needed
3. **Create tests** for Phase 1-3 (TDD approach)
4. **Implement code changes** to make tests pass
5. **Manual validation** using testing checklist
6. **Code review** and merge

---

## References

- Existing implementation: `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts`
- Focus management: `src/renderer/features/todos/hooks/useTodoFocus.ts`
- Todo operations: `src/renderer/features/todos/store/useTodosStore.ts`
- Related feature ideas: `docs/ideas/text-editor-features.md`
