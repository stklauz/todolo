## Refactoring `useDragReorder` – Step‑by‑Step Guide

This guide walks you through refactoring the `useDragReorder` hook in small, safe steps. It’s written assuming you’re new to the codebase and want very explicit guidance.

- Target file: `src/renderer/features/todos/hooks/useDragReorder.ts`
- Related tests: `src/renderer/features/todos/hooks/__tests__/useDragReorder.test.tsx`
- Related component: `src/renderer/features/todos/components/TodoList/TodoList.tsx`
- Existing helpers and new hooks:
  - `src/renderer/features/todos/utils/dragDropUtils.ts` (already exists)
  - `src/renderer/features/todos/hooks/useDragState.ts`
  - `src/renderer/features/todos/hooks/useDropValidation.ts`
  - (Optional) `src/renderer/features/todos/hooks/useDragHandlers.ts`

The main goals:

- Reduce complexity and duplication in `useDragReorder`.
- Introduce a clear `DragState` state machine.
- Split responsibilities into smaller, focused hooks and utilities.
- Keep behavior and tests passing at every step.

---

## 0. Prerequisites and Mental Model

Before changing code, make sure you know:

- Where `useDragReorder` lives and who uses it.
- How the tests describe its behavior.

1. Open `src/renderer/features/todos/hooks/useDragReorder.ts`.
2. Identify the main parts:
   - State and refs:
     - `dragInfo`, `dropTargetId`, `dropAtSectionEnd`.
     - `dragInfoRef`.
   - Event handlers:
     - `handleDragStart`
     - `handleDragEnd`
     - `handleDragOver`
     - `handleDragLeave`
     - `handleDropOn`
     - `handleDragOverEndZone`
     - `handleDragLeaveEndZone`
     - `handleDropAtEnd`
   - The returned object at the bottom (public API).
3. Skim `src/renderer/features/todos/hooks/__tests__/useDragReorder.test.tsx` and read test names to understand:
   - What behaviors are critical.
   - Which edge cases matter (e.g., parent/child moves, section boundaries, end‑of‑section drops).

You don’t need to fully understand every line yet; just get familiar with where things are.

---

## 1. Step One – Extract Pure Helper Functions (`dragDropUtils`)

**Goal:** Wire `useDragReorder` to use the existing helpers in `dragDropUtils.ts` and, where needed, incrementally extend those helpers. This reduces duplication and makes the logic easier to test in isolation.

You are **not** changing behavior in this step, just moving logic from `useDragReorder` into helpers that already exist (or extending them slightly when needed).

### 1.1. Confirm what already exists in `dragDropUtils.ts`

Open:

- `src/renderer/features/todos/utils/dragDropUtils.ts`

You should see helpers such as:

- `isChildOf`
- `computeSection`
- `extractTodoBlock`
- `insertTodoBlock`
- `removeTodoBlock`
- `fixOrphanedChildren`
- `findLastIndexInSection`
- `validateDragOperation`

These already cover many of the responsibilities we want to move out of `useDragReorder`.

### 1.2. Identify duplicated logic in `useDragReorder`

In `useDragReorder.ts`, find the big block of logic inside `handleDropOn` that:

- Locates the source index (`srcIndex0`).
- Computes `srcStart`/`srcEnd` as the “block” of rows to move.
- Checks if the target is inside the source block.
- Splices the block out and inserts it elsewhere.
- Normalizes indentation for the moved row (so it’s not too deep).
- Fixes parent/child relationships for certain moves.

Also find similar logic inside `handleDropAtEnd` that:

- Extracts a parent + children block (or a single child).
- Determines the last index in the target section.
- Inserts the block at the end of that section.
- Fixes potential orphan children and sets `parentId`/`indent`.

These areas should be refactored to use the helpers already available in `dragDropUtils.ts` where possible, instead of duplicating logic.

### 1.3. Reuse and extend `dragDropUtils` helpers

Rather than creating entirely new helpers from scratch, prefer plugging the existing ones into `useDragReorder`:

- Use `validateDragOperation` to centralize checks for:
  - Self‑drop (`sourceId === targetId`).
  - Cross‑section drops.
  - Parent→child inversion via `isChildOf`.
- Use `extractTodoBlock` + `removeTodoBlock` + `insertTodoBlock` to:
  - Extract the block to move (parent + children or single child).
  - Remove it from the list.
  - Insert it at the correct index.
- Use `findLastIndexInSection` to compute the insertion point at the end of a section in `handleDropAtEnd`.
- Use or extend `fixOrphanedChildren` to apply the orphan‑fixing behavior currently implemented in `useDragReorder` after certain moves.

If you find that the existing helpers are close but not an exact match for what `useDragReorder` needs, you can:

- Slightly extend their signatures (for example, pass more context if needed).
- Or create small, new helpers that compose them.

### 1.4. Replace inlined logic in handlers with helper calls

Step‑by‑step approach:

1. In `handleDropOn`, replace inline validation logic (self‑drop, cross‑section, parent→child) with a call to `validateDragOperation`, and use its `valid` flag (and maybe `reason` for logging).
2. In the same handler, replace manual block extraction/insertion with `extractTodoBlock`, `removeTodoBlock`, and `insertTodoBlock`.
3. Apply `fixOrphanedChildren` (or an extended/adjusted version) when you need to repair indent/parent relationships after moves.
4. In `handleDropAtEnd`, reuse `extractTodoBlock`, `removeTodoBlock`, `insertTodoBlock`, and `findLastIndexInSection` to mirror the existing behavior, plus `fixOrphanedChildren` where appropriate.
5. Run `useDragReorder` tests after each small change to ensure behavior remains identical.

During this step, keep a one‑to‑one mapping between old behavior and helper‑based behavior. Refine or reorganize helpers only after they’re wired in and covered by tests.

---

## 2. Step Two – Introduce a Minimal `DragState` Inside `useDragReorder`

**Goal:** Replace multiple separate pieces of state (`dragInfo`, `dropTargetId`, `dropAtSectionEnd`) with a single state machine (`DragState`). This makes the flow easier to reason about and prepares for extracting `useDragState`.

### 2.1. Define the `DragState` type

Near the top of `useDragReorder.ts`, add a union type that captures the main drag states. For example:

```ts
type DragState =
  | { type: 'idle' }
  | { type: 'dragging'; itemId: number; section: Section }
  | { type: 'hoveringItem'; itemId: number; section: Section; targetId: number }
  | { type: 'hoveringEnd'; itemId: number; section: Section };
```

This is a starting point; you can adjust later as you better understand the behavior.

### 2.2. Add `dragState` alongside existing state

Add a new piece of state:

```ts
const [dragState, setDragState] = React.useState<DragState>({ type: 'idle' });
```

At this stage, **do not** remove `dragInfo`, `dropTargetId`, or `dropAtSectionEnd` yet. You will migrate usage gradually to avoid breaking behavior.

### 2.3. Gradually migrate handlers to use `dragState`

Pick one handler at a time and move its logic to use the new state:

- `handleDragStart`:
  - Currently sets `dragInfo`.
  - Also set `dragState` to `{ type: 'dragging', itemId: id, section }`.

- `handleDragOver`:
  - After validations (same section, not child of itself, etc.), set:
    - `dragState` to `{ type: 'hoveringItem', itemId: sourceId, section, targetId }`.

- `handleDragOverEndZone`:
  - When allowed, set:
    - `dragState` to `{ type: 'hoveringEnd', itemId: sourceId, section }`.

- `handleDragEnd`:
  - Set `dragState` back to `{ type: 'idle' }`.

Keep using `dragInfo`, `dropTargetId`, and `dropAtSectionEnd` for the return values until you’re confident, but try to derive them from `dragState` as you go.

### 2.4. Derive old state from `dragState`

Once `dragState` is updated in all relevant places, you can derive the old fields:

```ts
const dragInfo =
  dragState.type === 'dragging' ||
  dragState.type === 'hoveringItem' ||
  dragState.type === 'hoveringEnd'
    ? { id: dragState.itemId, section: dragState.section }
    : null;

const dropTargetId =
  dragState.type === 'hoveringItem' ? dragState.targetId : null;

const dropAtSectionEnd =
  dragState.type === 'hoveringEnd' ? dragState.section : null;
```

After this, you can remove the original `useState` hooks for `dragInfo`, `dropTargetId`, and `dropAtSectionEnd`, keeping the external API unchanged.

Run `useDragReorder` tests to confirm behavior matches.

---

## 3. Step Three – Extract `useDragState` Hook

**Goal:** Move the drag state machine (state + transitions) into a dedicated reusable hook, `useDragState`, to simplify `useDragReorder`.

### 3.1. Create `useDragState.ts`

New file:

- `src/renderer/features/todos/hooks/useDragState.ts`

This hook should:

- Define and export the `DragState` type.
- Manage the `dragState` via `useState`.
- Optionally maintain a ref to the current state for use in callbacks (`dragStateRef`).
- Expose functions to transition between states:
  - `startDrag`
  - `endDrag`
  - `hoverItem`
  - `hoverEnd`

Example structure:

```ts
import React from 'react';
import type { Section } from '../types';

export type DragState =
  | { type: 'idle' }
  | { type: 'dragging'; itemId: number; section: Section }
  | { type: 'hoveringItem'; itemId: number; section: Section; targetId: number }
  | { type: 'hoveringEnd'; itemId: number; section: Section };

export function useDragState() {
  const [dragState, setDragState] = React.useState<DragState>({ type: 'idle' });
  const dragStateRef = React.useRef<DragState>(dragState);

  React.useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const startDrag = (itemId: number, section: Section) => {
    setDragState({ type: 'dragging', itemId, section });
  };

  const endDrag = () => {
    setDragState({ type: 'idle' });
  };

  const hoverItem = (itemId: number, section: Section, targetId: number) => {
    setDragState({ type: 'hoveringItem', itemId, section, targetId });
  };

  const hoverEnd = (itemId: number, section: Section) => {
    setDragState({ type: 'hoveringEnd', itemId, section });
  };

  return {
    dragState,
    dragStateRef,
    startDrag,
    endDrag,
    hoverItem,
    hoverEnd,
  } as const;
}
```

You can adapt this to match the evolved `DragState` you ended up with in Step 2.

### 3.2. Use `useDragState` inside `useDragReorder`

In `useDragReorder.ts`:

1. Import `useDragState` and use it at the top of the hook:

   ```ts
   const { dragState, dragStateRef, startDrag, endDrag, hoverItem, hoverEnd } =
     useDragState();
   ```

2. Update handlers:
   - `handleDragStart` → call `startDrag(...)`.
   - `handleDragEnd` → call `endDrag()`.
   - `handleDragOver` → call `hoverItem(...)` when valid.
   - `handleDragOverEndZone` → call `hoverEnd(...)` when valid.

3. Continue deriving `dragInfo`, `dropTargetId`, and `dropAtSectionEnd` from `dragState` as in Step 2.

Run tests again to confirm everything still works.

---

## 4. Step Four – Extract `useDropValidation`

**Goal:** Move the business rules that decide whether a drop is allowed into a dedicated module (`useDropValidation.ts`). This keeps `useDragReorder` focused on orchestration and separates rules from state.

### 4.1. Identify validation rules

In `useDragReorder.ts`, look for conditions like:

- No drag information (no current drag).
- Source and target are in different sections.
- Source and target are the same item.
- Dropping a parent under its own child (checked via `checkIsChildOf`).

These can become functions like:

- `canDropOnItem(dragState, targetId, sectionOf, checkIsChildOf)`
- `canDropAtEnd(dragState, sectionOf)`

### 4.2. Create `useDropValidation.ts`

New file:

- `src/renderer/features/todos/hooks/useDropValidation.ts`

Start with pure functions (no React):

```ts
import type { Section } from '../types';
import type { DragState } from './useDragState';

export function canDropOnItem(
  dragState: DragState,
  targetId: number,
  sectionOf: (id: number) => Section,
  checkIsChildOf: (sourceId: number, targetId: number) => boolean,
): boolean {
  // Implement the same checks currently in handleDropOn
}

export function canDropAtEnd(dragState: DragState, section: Section): boolean {
  // Implement the checks currently in handleDropAtEnd
}
```

### 4.3. Use validation functions inside `useDragReorder`

In `useDragReorder.ts`:

1. Import `canDropOnItem` and `canDropAtEnd`.
2. Inside `handleDropOn`, before applying the drop:
   - Call `canDropOnItem(...)`.
   - If it returns `false`, log via `debugLogger` and abort the drop (maybe call `handleDragEnd`).
3. Inside `handleDropAtEnd`, do the same with `canDropAtEnd(...)`.

Keep logs in `useDragReorder.ts` (the orchestrator) and keep `useDropValidation` focused on pure rules.

Run tests again to ensure behavior and edge cases are unchanged.

---

## 5. Step Five (Optional) – Extract `useDragHandlers`

**Goal:** If `useDragReorder.ts` is still too large or complex after previous steps, move the event handler definitions into a dedicated hook `useDragHandlers`.

This step is optional and should only be done if it clearly improves readability and keeps within your line/complexity targets.

### 5.1. Create `useDragHandlers.ts`

New file:

- `src/renderer/features/todos/hooks/useDragHandlers.ts`

This hook should:

- Accept dependencies it needs to handle events:
  - `dragState` and actions from `useDragState`.
  - `setTodos`.
  - Helpers from `dragDropUtils`.
  - Validation functions from `useDropValidation`.
  - `sectionOf` and `checkIsChildOf`.
- Return:
  - `handleDragStart`, `handleDragEnd`, `handleDragOver`, `handleDropOn`, `handleDragOverEndZone`, `handleDragLeave`, `handleDragLeaveEndZone`, `handleDropAtEnd`.

Structure example:

```ts
import React from 'react';
import type { DragState } from './useDragState';
import type { Section } from '../types';
import type { EditorTodo } from '../types';

type GetTodos = () => EditorTodo[];
type SetTodos = (updater: (prev: EditorTodo[]) => EditorTodo[]) => void;

export function useDragHandlers(deps: {
  dragState: DragState;
  dragStateRef: React.RefObject<DragState>;
  startDrag: (id: number, section: Section) => void;
  endDrag: () => void;
  hoverItem: (id: number, section: Section, targetId: number) => void;
  hoverEnd: (id: number, section: Section) => void;
  getTodos: GetTodos;
  setTodos: SetTodos;
  sectionOf: (id: number) => Section;
  checkIsChildOf: (sourceId: number, targetId: number) => boolean;
}) {
  const handleDragStart = React.useCallback(() => {
    // Use deps.startDrag, etc.
  }, [deps]);

  // Define the other handlers similarly...

  return {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDropOn,
    handleDragOverEndZone,
    handleDragLeaveEndZone,
    handleDropAtEnd,
  } as const;
}
```

You will move the handler bodies from `useDragReorder.ts` into this hook.

### 5.2. Make `useDragReorder` an orchestrator

After extracting `useDragHandlers`, `useDragReorder.ts` should:

1. Set up state via `useDragState`.
2. Set up helpers/validation (`dragDropUtils`, `useDropValidation`).
3. Call `useDragHandlers` with all dependencies.
4. Compute `dragInfo`, `dropTargetId`, and `dropAtSectionEnd` from `dragState`.
5. Return all values and handlers from `useDragHandlers` as its public API.

At this point:

- `useDragReorder` should be well under your line/complexity thresholds.
- Each hook and utility should be focused and easier to test in isolation.

---

## 6. Testing and Safety Tips

Given your development rules and the importance of this hook, keep these habits:

- After each significant step (helper extraction, state machine introduction, hook extraction), run the `useDragReorder` test suite.
- Make changes in very small increments:
  - Extract one helper → run tests.
  - Introduce `DragState` for one handler → run tests.
  - Only move on when tests are green.
- Keep behavior identical at each step:
  - Avoid “improvements” or new features while refactoring.
  - Use the tests as your specification.

If a test fails:

- Read the failure message carefully; it usually tells you which scenario changed.
- Compare the old logic and the new helper/hook to see where the behavior diverged.

---

## 7. Suggested Order of Work

If you feel overwhelmed, use this exact order:

1. Extract one or two helpers into `dragDropUtils.ts` from `handleDropOn` and `handleDropAtEnd`.
2. Introduce `DragState` type and `dragState` inside `useDragReorder.ts` (keep old state for now).
3. Gradually migrate handlers to use `dragState` and derive old fields from it.
4. Extract `useDragState.ts` and wire it into `useDragReorder.ts`.
5. Extract `useDropValidation.ts` and move rule checks into it.
6. (Optional) Extract `useDragHandlers.ts` if needed to reach complexity targets.

You don’t need to complete all steps in one session. Even completing steps 1–4 will significantly improve maintainability and clarity.

---

## 8. How to Ask for Help from Future You (or Others)

While you work through this guide, consider:

- Leaving short, focused commit messages (if using git) after each successful step.
- Adding comments in complex helpers documenting key invariants, especially around parent/child relationships and indentation rules.
- Updating any internal docs (like `docs/ideas/unified-technical-debt-plan.md`) once you’ve finished so they reflect the new structure.

This way, future you—or other contributors—can quickly understand how drag‑and‑drop is structured and extended.
