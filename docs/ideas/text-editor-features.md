# Text Editor Features: Readiness Assessment & Implementation Plan

**Status**: Proposed Features  
**Priority**: P1 - Feature Development  
**Created**: 2025-11-03  
**Readiness**: ✅ **YES - Architecture is ready**

---

## Proposed Features

### 1. Split Todo on Enter (Mid-Text)

**Feature**: Pressing Enter in the middle of a todo splits the content

- **Left content**: Stays in original todo
- **Right content**: Moves to new todo below
- **Cursor**: Moves to start of new todo

**Example:**

```
Before: "Buy groceries and|cook dinner"  (cursor at |)
After:  "Buy groceries and"
        "|cook dinner"  (new todo, cursor at start)
```

---

### 2. Auto-Focus Empty Todo Below

**Feature**: After entering content in a todo, automatically focus on the next empty todo

**Example:**

```
Current todo: "Buy milk" (user just typed this)
Below: "" (empty todo)
→ Cursor automatically moves to empty todo
```

---

### 3. Arrow Key Navigation

**Feature**: Use arrow keys to navigate between todos like a text editor

**Behaviors:**

- **ArrowUp** at start of todo → move to previous todo (end of text)
- **ArrowDown** at end of todo → move to next todo (start of text)
- **ArrowUp/Down** in middle of text → normal behavior (move within line)

---

## Architecture Readiness Assessment

### ✅ Strengths (Already Have)

#### 1. **Solid Keyboard Handler Foundation**

```typescript
// src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts
// Already handles: Tab, Enter, Backspace
// Adding ArrowUp/ArrowDown is straightforward
```

**Verdict**: ✅ Easy to extend

#### 2. **Focus Management System**

```typescript
// src/renderer/features/todos/hooks/useTodoFocus.ts
// Already has:
// - inputByIdRef: tracks all inputs
// - focusTodo(): schedules focus
// - setSelectionRange(): positions cursor
```

**Verdict**: ✅ All infrastructure exists

#### 3. **Todo Operations**

```typescript
// Already have:
// - insertTodoBelow(index, text): creates new todo
// - updateTodo(id, text): updates existing todo
// - Focus system: moves cursor automatically
```

**Verdict**: ✅ All primitives available

#### 4. **Good Test Coverage**

- 65% overall coverage
- Testing infrastructure in place
- E2E tests for keyboard interactions exist

**Verdict**: ✅ Can test new features confidently

---

### ⚠️ Considerations (Minor Adjustments Needed)

#### 1. **Cursor Position Detection**

**Need**: Get cursor position within textarea

**Solution**: Simple DOM API

```typescript
const getCursorPosition = (el: HTMLTextAreaElement): number => {
  return el.selectionStart;
};

const isAtStart = (el: HTMLTextAreaElement): boolean => {
  return el.selectionStart === 0;
};

const isAtEnd = (el: HTMLTextAreaElement): boolean => {
  return el.selectionStart === el.value.length;
};
```

**Effort**: Trivial (5 minutes)

#### 2. **Enhanced Enter Handler**

**Current**: Creates empty todo below
**Needed**: Split content based on cursor position

**Solution**: Modify `handleEnterKey` in `useTodoKeyboardHandlers.ts`

```typescript
function handleEnterKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  index: number,
  allTodos: EditorTodo[],
  updateTodo: (id: number, text: string) => void,
  insertTodoBelow: (index: number, text?: string) => number,
  focusTodo: (id: number) => void,
): void {
  event.preventDefault();

  const el = event.currentTarget;
  const cursorPos = el.selectionStart;
  const text = el.value;

  const leftContent = text.slice(0, cursorPos);
  const rightContent = text.slice(cursorPos);

  // Update current todo with left content
  const cur = allTodos[index];
  updateTodo(cur.id, leftContent);

  // Create new todo with right content
  const newId = insertTodoBelow(index, rightContent);
  focusTodo(newId);
}
```

**Effort**: 15-30 minutes

#### 3. **Arrow Key Navigation**

**Need**: Add ArrowUp/ArrowDown handlers

**Solution**: Add cases to keyboard handler switch

```typescript
case 'ArrowUp':
  if (isAtStart(event.currentTarget)) {
    event.preventDefault();
    const prevTodo = allTodos[index - 1];
    if (prevTodo) {
      focusTodo(prevTodo.id);
      // In focus effect, position cursor at end
    }
  }
  break;

case 'ArrowDown':
  if (isAtEnd(event.currentTarget)) {
    event.preventDefault();
    const nextTodo = allTodos[index + 1];
    if (nextTodo) {
      focusTodo(nextTodo.id);
      // In focus effect, position cursor at start
    }
  }
  break;
```

**Effort**: 30-45 minutes

#### 4. **Enhanced Focus Effect**

**Need**: Support positioning cursor at start/end when focusing

**Current**: Always positions at end

```typescript
// useTodoFocusEffect (line 109)
el.setSelectionRange(el.value.length, el.value.length);
```

**Solution**: Add cursor position parameter

```typescript
type FocusPosition = 'start' | 'end';

const focusTodo = React.useCallback(
  (id: number, position: FocusPosition = 'end') => {
    focusNextIdRef.current = { id, position };
  },
  [],
);

// In effect:
if (el) {
  el.focus();
  const pos = position === 'start' ? 0 : el.value.length;
  el.setSelectionRange(pos, pos);
}
```

**Effort**: 15-20 minutes

---

## ⛔ Blockers Assessment

### None! 🎉

**BUT** - there's a **strategic decision** to make:

### Should you implement BEFORE or AFTER the Context → Store refactor?

#### Option A: Implement Now (Before Refactor)

**Pros:**

- ✅ Get features shipped faster
- ✅ User value delivered sooner
- ✅ Features work independently of architecture

**Cons:**

- ❌ Will need to update during refactor (but minimal)
- ❌ Slightly more complex to test (need TodosProvider wrapper)

**Recommendation**: ✅ **DO THIS** if you want features soon

---

#### Option B: Implement After Refactor (After Store Migration)

**Pros:**

- ✅ Cleaner implementation (direct store access)
- ✅ Easier testing (mock store directly)
- ✅ No rework needed

**Cons:**

- ❌ Features delayed by 13-17 hours (refactor time)
- ❌ Users wait longer

**Recommendation**: ❌ **SKIP** unless refactor is already in progress

---

## My Recommendation: Implement Now

### Why?

1. **Architecture is ready** - No blockers exist
2. **Features are isolated** - Text editing logic doesn't touch state management architecture
3. **Minimal refactor impact** - Keyboard handlers rarely change during architecture refactors
4. **User value** - Get better UX shipped sooner
5. **Technical debt is acceptable** - These features won't make the Context issue worse

### The refactor CAN wait

The Context → Store refactor is important for **developer experience** and **code maintainability**, but it's **not blocking feature development**. Your app is production-ready NOW.

---

## Implementation Plan

### Phase 1: Cursor Utilities (30 min)

```typescript
// src/renderer/features/todos/utils/cursorUtils.ts
export const getCursorPosition = (el: HTMLTextAreaElement): number => {
  return el.selectionStart;
};

export const isAtStart = (el: HTMLTextAreaElement): boolean => {
  return el.selectionStart === 0;
};

export const isAtEnd = (el: HTMLTextAreaElement): boolean => {
  return el.selectionStart === el.value.length;
};

export const setCursorPosition = (
  el: HTMLTextAreaElement,
  position: number | 'start' | 'end',
): void => {
  const pos =
    position === 'start' ? 0 : position === 'end' ? el.value.length : position;
  el.setSelectionRange(pos, pos);
};
```

**Tests:**

```typescript
describe('cursorUtils', () => {
  test('isAtStart returns true when cursor at start', () => {
    const el = document.createElement('textarea');
    el.value = 'hello';
    el.setSelectionRange(0, 0);
    expect(isAtStart(el)).toBe(true);
  });
  // ... more tests
});
```

---

### Phase 2: Enhanced Enter Handler (45 min)

**Update**: `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts`

```typescript
import { getCursorPosition } from '../utils/cursorUtils';

// Update handleEnterKey signature to include updateTodo
function handleEnterKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  index: number,
  allTodos: EditorTodo[],
  updateTodo: (id: number, text: string) => void, // ADD THIS
  insertTodoBelow: (index: number, text?: string) => number,
  focusTodo: (id: number) => void,
): void {
  event.preventDefault();

  const cur = allTodos[index];
  if (!cur) return;

  const el = event.currentTarget;
  const cursorPos = getCursorPosition(el);
  const text = el.value;

  // Handle empty todo (keep existing behavior)
  if (text.trim().length === 0) {
    return;
  }

  // Split content at cursor
  const leftContent = text.slice(0, cursorPos).trimEnd();
  const rightContent = text.slice(cursorPos).trimStart();

  // Update current todo with left content
  if (leftContent !== text) {
    updateTodo(cur.id, leftContent);
  }

  // Create new todo with right content (or empty if at end)
  const newId = insertTodoBelow(index, rightContent);
  focusTodo(newId);
}

// Update the hook to pass updateTodo
export default function useTodoKeyboardHandlers({
  allTodos,
  updateTodo, // ADD THIS
  changeIndent,
  insertTodoBelow,
  removeTodoAt,
  focusTodo,
}: UseTodoKeyboardHandlersProps) {
  return React.useCallback(
    (id: number) => {
      return (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const index = allTodos.findIndex((t) => t.id === id);
        if (index === -1) return;

        switch (event.key) {
          case 'Tab':
            handleTabKey(event, id, index, allTodos, changeIndent);
            break;
          case 'Enter':
            handleEnterKey(
              event,
              index,
              allTodos,
              updateTodo,
              insertTodoBelow,
              focusTodo,
            );
            break;
          // ... rest
        }
      };
    },
    [
      allTodos,
      updateTodo,
      changeIndent,
      insertTodoBelow,
      removeTodoAt,
      focusTodo,
    ],
  );
}
```

**Tests:**

```typescript
describe('handleEnterKey - split content', () => {
  test('splits content at cursor position', () => {
    const updateTodo = jest.fn();
    const insertTodoBelow = jest.fn(() => 2);
    const focusTodo = jest.fn();

    const todos = [
      { id: 1, text: 'Buy groceries and cook dinner', completed: false },
    ];

    const handleKeyDown = useTodoKeyboardHandlers({
      allTodos: todos,
      updateTodo,
      insertTodoBelow,
      // ... other props
    });

    const textarea = document.createElement('textarea');
    textarea.value = 'Buy groceries and cook dinner';
    textarea.setSelectionRange(17, 17); // After "and"

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(event, 'currentTarget', { value: textarea });

    handleKeyDown(1)(event as any);

    expect(updateTodo).toHaveBeenCalledWith(1, 'Buy groceries and');
    expect(insertTodoBelow).toHaveBeenCalledWith(0, 'cook dinner');
    expect(focusTodo).toHaveBeenCalledWith(2);
  });
});
```

---

### Phase 3: Arrow Key Navigation (1 hour)

**Update**: `src/renderer/features/todos/hooks/useTodoKeyboardHandlers.ts`

```typescript
import { isAtStart, isAtEnd } from '../utils/cursorUtils';

// Add to switch statement:
case 'ArrowUp':
  handleArrowUpKey(event, index, allTodos, focusTodo);
  break;
case 'ArrowDown':
  handleArrowDownKey(event, index, allTodos, focusTodo);
  break;

// New handlers:
function handleArrowUpKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  index: number,
  allTodos: EditorTodo[],
  focusTodo: (id: number, position?: 'start' | 'end') => void,
): void {
  const el = event.currentTarget;

  // Only handle if cursor is at start of text
  if (!isAtStart(el)) return;

  // Find previous todo
  const prevTodo = allTodos[index - 1];
  if (!prevTodo) return;

  event.preventDefault();
  focusTodo(prevTodo.id, 'end');
}

function handleArrowDownKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  index: number,
  allTodos: EditorTodo[],
  focusTodo: (id: number, position?: 'start' | 'end') => void,
): void {
  const el = event.currentTarget;

  // Only handle if cursor is at end of text
  if (!isAtEnd(el)) return;

  // Find next todo
  const nextTodo = allTodos[index + 1];
  if (!nextTodo) return;

  event.preventDefault();
  focusTodo(nextTodo.id, 'start');
}
```

**Update**: `src/renderer/features/todos/hooks/useTodoFocus.ts`

```typescript
// Update focusTodo to accept position
const focusTodo = React.useCallback(
  (id: number, position: 'start' | 'end' = 'end') => {
    focusNextIdRef.current = { id, position };
  },
  [],
);

// Update effect to handle position
export function useTodoFocusEffect(
  todos: EditorTodo[],
  focusNextIdRef: React.MutableRefObject<{
    id: number;
    position: 'start' | 'end';
  } | null>,
  inputByIdRef: React.MutableRefObject<Map<number, HTMLTextAreaElement>>,
  isEditingRef?: React.MutableRefObject<boolean>,
) {
  React.useEffect(() => {
    if (isEditingRef?.current) return;

    const focusRequest = focusNextIdRef.current;
    if (focusRequest) {
      const el = inputByIdRef.current.get(focusRequest.id);
      if (el) {
        el.focus();
        const pos = focusRequest.position === 'start' ? 0 : el.value.length;
        el.setSelectionRange(pos, pos);
        focusNextIdRef.current = null;
      }
    }
    // ... rest
  }, [todos, focusNextIdRef, inputByIdRef, isEditingRef]);
}
```

**Tests:**

```typescript
describe('Arrow key navigation', () => {
  test('ArrowUp at start moves to previous todo', () => {
    const focusTodo = jest.fn();
    const todos = [
      { id: 1, text: 'First', completed: false },
      { id: 2, text: 'Second', completed: false },
    ];

    const handleKeyDown = useTodoKeyboardHandlers({
      allTodos: todos,
      focusTodo,
      // ... other props
    });

    const textarea = document.createElement('textarea');
    textarea.value = 'Second';
    textarea.setSelectionRange(0, 0); // At start

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    Object.defineProperty(event, 'currentTarget', { value: textarea });

    handleKeyDown(2)(event as any);

    expect(focusTodo).toHaveBeenCalledWith(1, 'end');
  });

  test('ArrowUp in middle of text does nothing', () => {
    const focusTodo = jest.fn();
    const todos = [
      { id: 1, text: 'First', completed: false },
      { id: 2, text: 'Second', completed: false },
    ];

    const textarea = document.createElement('textarea');
    textarea.value = 'Second';
    textarea.setSelectionRange(3, 3); // In middle

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    Object.defineProperty(event, 'currentTarget', { value: textarea });

    handleKeyDown(2)(event as any);

    expect(focusTodo).not.toHaveBeenCalled();
  });
});
```

---

### Phase 4: Auto-Focus Empty Todo (30 min)

**Note**: This might already work! Your current `useTodoFocusEffect` has logic for single empty todos.

**Enhancement needed**: After user types in a todo, check if there's an empty todo below and focus it.

**Option A**: Add to `onChange` handler in TodoList

```typescript
// TodoList.tsx
onChange={(e) => {
  const newText = e.target.value;
  updateTodo(todo.id, newText);

  // If user just typed content and next todo is empty, focus it
  if (newText.trim().length > 0 && todo.text.trim().length === 0) {
    const nextTodo = todos[index + 1];
    if (nextTodo && nextTodo.text.trim().length === 0) {
      focusTodo(nextTodo.id);
    }
  }
}}
```

**Option B**: Handle in store/hook as side effect

- More complex, but separates concerns
- Probably overkill for this feature

**Recommendation**: Option A (simple, effective)

---

## Testing Strategy

### Unit Tests

- [ ] cursorUtils functions
- [ ] handleEnterKey with split content
- [ ] handleArrowUpKey
- [ ] handleArrowDownKey
- [ ] focusTodo with position parameter

### Integration Tests

- [ ] Enter in middle splits and focuses new todo
- [ ] Enter at end creates empty todo
- [ ] ArrowUp navigates to previous
- [ ] ArrowDown navigates to next
- [ ] Auto-focus empty todo after typing

### E2E Tests

- [ ] Full text editing workflow
- [ ] Navigate between multiple todos
- [ ] Split todo and continue editing

**Test coverage target**: 80%+ for new code

---

## Timeline Estimate

| Phase     | Task                   | Time          | Risk    |
| --------- | ---------------------- | ------------- | ------- |
| 1         | Cursor utilities       | 30 min        | Low     |
| 2         | Enhanced Enter (split) | 45 min        | Low     |
| 3         | Arrow navigation       | 1 hour        | Low     |
| 4         | Auto-focus empty       | 30 min        | Low     |
| 5         | Tests                  | 1.5 hours     | Low     |
| 6         | Manual testing         | 30 min        | Low     |
| **Total** |                        | **4-5 hours** | **Low** |

**This is a half-day of work.** Very achievable!

---

## Final Verdict

### ✅ **YES, your app is 100% ready**

**Reasoning:**

1. ✅ All infrastructure exists (keyboard handlers, focus management, todo operations)
2. ✅ Good separation of concerns (easy to add features)
3. ✅ Testing infrastructure in place
4. ✅ No architectural blockers
5. ✅ Features are isolated (won't impact other systems)

**The Context → Store refactor is NOT a blocker.** It's important for maintainability, but your app is production-ready and can ship features now.

---

## Recommendation

### Ship order:

1. **Now** (4-5 hours): Implement text editor features
2. **Next sprint** (13-17 hours): Context → Store refactor
3. **Following sprint** (7-10 hours): P1 tech debt items

**Why this order?**

- User value first (better UX)
- Architecture second (better DX)
- Quality third (maintainability)

This is a healthy balance. **Your architecture is good enough** that you don't need to pause feature development to fix it.

---

## Questions?

**Q: Will these features be harder after the refactor?**  
**A**: No. They'll be slightly easier (less boilerplate), but not significantly.

**Q: Will I have to rewrite these features during refactor?**  
**A**: Minimal changes (update imports, pass `updateTodo` from store instead of context). ~15 min of work.

**Q: Should I do anything special to make refactor easier?**  
**A**: Yes - keep business logic in utility functions, not inline in handlers. Makes it easy to reuse regardless of state management approach.

---

**Go build those features! Your app is ready. 🚀**
