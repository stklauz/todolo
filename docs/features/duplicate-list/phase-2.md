# Phase 2 — UI Integration & Accessibility

Scope
- Make Duplicate/Delete available only in the title actions menu (not the sidebar list items)
- Keyboard accessibility and focus management after duplication
- Optional spinner for operations >150–300ms

Acceptance Criteria
- Title actions menu shows "Duplicate list" above "Delete list" consistently
- While duplicating, the action is disabled; no double triggers
- After success, the new list is selected, scrolled into view, and receives keyboard focus (list item button)
- ARIA live region announces status non-intrusively

Implementation Details
- Menu structure (TodoApp.tsx title actions):
  - data-testid="menu-duplicate-list"
  - data-testid="menu-delete-list"
- Spinner flicker control: show spinner icon only if op exceeds 150–300ms threshold
- Name policy: always append "(Copy)" (duplicate names allowed)

Example Snippet
```tsx
<div role="menu">
  <button
    type="button"
    data-testid="menu-duplicate-list"
    onClick={() => handleDuplicate(selectedListId)}
    disabled={isDuplicating}
  >
    {showSpinner ? <Spinner size={12} /> : null}
    Duplicate list
  </button>
  <button
    type="button"
    data-testid="menu-delete-list"
    onClick={handleDelete}
    disabled={!canDelete}
  >
    Delete list
  </button>
</div>
```

Focus Management
- On success: after selection update, call `scrollIntoView({ block: 'nearest' })` on the new list element
- Then call `element.focus()` to move keyboard focus

Tests
- RTL: verify title actions menu order via testids
- RTL: simulate click; assert button disabled state during in-flight
- RTL: assert focus is on the newly created list element after success
