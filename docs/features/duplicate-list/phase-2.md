# Phase 2 — UI Integration & Accessibility

Scope
- Fully integrate the context menu entry (order and visibility)
- Keyboard accessibility and focus management after duplication
- Optional spinner for operations >150–300ms

Acceptance Criteria
- Context menu shows "Duplicate list" above "Delete list" consistently
- While duplicating, the action is disabled; no double triggers
- After success, the new list is selected, scrolled into view, and receives keyboard focus (list item button)
- ARIA live region announces status non-intrusively

Implementation Details
- Menu structure (ListSidebar.tsx):
  - data-testid="menu-duplicate-list"
  - data-testid="menu-delete-list"
- Spinner flicker control: show spinner icon only if op exceeds 150–300ms threshold
- Name policy: always append "(Copy)" (duplicate names allowed)

Example Snippet
```tsx
<ul role="menu">
  <li role="menuitem">
    <button
      type="button"
      data-testid="menu-duplicate-list"
      onClick={() => handleDuplicate(listId)}
      disabled={isDuplicating}
    >
      {showSpinner ? <Spinner size={12} /> : null}
      Duplicate list
    </button>
  </li>
  <li role="menuitem">
    <button type="button" data-testid="menu-delete-list" onClick={() => handleDelete(listId)}>
      Delete list
    </button>
  </li>
 </ul>
```

Focus Management
- On success: after selection update, call `scrollIntoView({ block: 'nearest' })` on the new list element
- Then call `element.focus()` to move keyboard focus

Tests
- RTL: verify menu order via testids
- RTL: simulate click; assert button disabled state during in-flight
- RTL: assert focus is on the newly created list element after success

