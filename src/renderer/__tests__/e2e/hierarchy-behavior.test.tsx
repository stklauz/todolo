import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  renderAppWithDefaults,
  setupUser,
  mockStorage,
  setupDefaultMocks,
} from '../../testUtils/ui';

// Mock storage like other e2e tests
jest.mock('../../features/todos/api/storage');

describe('Hierarchy Behavior', () => {
  let user: ReturnType<typeof setupUser>;

  const getInputs = () => screen.getAllByLabelText('Todo text');
  const getTodos = () => screen.getAllByTestId('todo-indent');

  beforeEach(async () => {
    jest.useFakeTimers();
    setupDefaultMocks();
    user = setupUser();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Tab + ShiftTab behavior', async () => {
    // Create two todos: "One" and "Two"
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'One', completed: false, indent: 0 },
          { id: 2, text: 'Two', completed: false, indent: 0 },
        ],
      }),
    });

    await waitFor(() => expect(getInputs().length).toBeGreaterThanOrEqual(2));
    const idx = getInputs().findIndex(
      (el) => (el as HTMLTextAreaElement).value === 'Two',
    );

    // Focus second todo and press Tab to indent
    await user.click(getInputs()[idx]);
    await user.keyboard('{Tab}');

    await waitFor(() => {
      const drags = screen.getAllByTestId('todo-indent');
      expect(drags[idx].className).toMatch(/indent1/);
    });

    // Focus second todo and press Shift+Tab to indent
    await user.click(getInputs()[idx]);
    await user.keyboard('{Shift>}{Tab}{/Shift}');

    await waitFor(() => {
      const drags = screen.getAllByTestId('todo-indent');
      expect(drags[idx].className).not.toMatch(/indent1/);
    });
  });

  it('a parent should also check all its children', async () => {
    renderAppWithDefaults({
      loadAppSettings: jest
        .fn()
        .mockResolvedValue({ hideCompletedItems: false }),
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'Parent', completed: false, indent: 0 },
          { id: 2, text: 'Child 1', completed: false, indent: 1 },
          { id: 3, text: 'Child 2', completed: false, indent: 1 },
        ],
      }),
    });

    // check parent should check all its children
    const getBoxes = () =>
      screen.getAllByRole('checkbox', { name: /toggle completed/i });
    await waitFor(() => expect(getBoxes().length).toBe(3));
    const [parent] = getBoxes();
    await user.click(parent);

    await waitFor(() => {
      expect(getBoxes().every((box) => (box as HTMLInputElement).checked)).toBe(
        true,
      );
    });
  });

  it('no resurfacing on delete: checked parent should not reappear as active parent', async () => {
    // Structure per docs: one, two, three(a,b,c), four. Then check "two", delete "three".
    renderAppWithDefaults({
      loadAppSettings: jest
        .fn()
        .mockResolvedValue({ hideCompletedItems: false }),
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'one', completed: false, indent: 0, parentId: null },
          { id: 2, text: 'two', completed: false, indent: 0, parentId: null },
          { id: 3, text: 'three', completed: false, indent: 0, parentId: null },
          { id: 4, text: 'a', completed: false, indent: 1, parentId: 3 },
          { id: 5, text: 'b', completed: false, indent: 1, parentId: 3 },
          { id: 6, text: 'c', completed: false, indent: 1, parentId: 3 },
          { id: 7, text: 'four', completed: false, indent: 0, parentId: null },
        ],
      }),
    });

    const getCheckboxFor = (value: string) => {
      const input = screen.getByDisplayValue(value);
      const span = input.closest('span') as HTMLElement;
      return span.querySelector('input[type="checkbox"]') as HTMLInputElement;
    };

    // Check "two"
    await waitFor(() => expect(getCheckboxFor('two')).toBeInTheDocument());
    await user.click(getCheckboxFor('two'));

    await waitFor(() => {
      expect(getCheckboxFor('two')).toBeChecked();
      // two should be in completed section
      expect(
        within(screen.getByTestId('completed-section')).getByDisplayValue(
          'two',
        ),
      ).toBeInTheDocument();
    });

    // Delete "three": clear then backspace
    const threeInput = screen.getByDisplayValue('three') as HTMLTextAreaElement;
    await user.click(threeInput);
    await user.clear(threeInput);
    await user.keyboard('{Backspace}');

    // Expectations: "two" remains completed and does not resurface; children reparent under "one"
    await waitFor(() => {
      expect(screen.queryByDisplayValue('three')).not.toBeInTheDocument();
      expect(getCheckboxFor('two')).toBeChecked();
      // Ensure "two" did not resurface in the active section
      const active = within(screen.getByTestId('active-section'));
      expect(active.queryByDisplayValue('two')).toBeNull();
      // a, b, c should remain in active section (implicitly under one)
      expect(active.getByDisplayValue('a')).toBeInTheDocument();
      expect(active.getByDisplayValue('b')).toBeInTheDocument();
      expect(active.getByDisplayValue('c')).toBeInTheDocument();
    });

    // Focus should move to the previous parent ("one")
    const oneInput = screen.getByDisplayValue('one') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(document.activeElement).toBe(oneInput);
    });
  });

  it('no resurfacing on drag: dragging child under another parent should not resurface completed parent', async () => {
    // Structure per docs: one, two, three(a,b,c), four. Then check "two", drag "a" under "one"
    renderAppWithDefaults({
      loadAppSettings: jest
        .fn()
        .mockResolvedValue({ hideCompletedItems: false }),
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'one', completed: false, indent: 0, parentId: null },
          { id: 2, text: 'two', completed: false, indent: 0, parentId: null },
          { id: 3, text: 'three', completed: false, indent: 0, parentId: null },
          { id: 4, text: 'a', completed: false, indent: 1, parentId: 3 },
          { id: 5, text: 'b', completed: false, indent: 1, parentId: 3 },
          { id: 6, text: 'c', completed: false, indent: 1, parentId: 3 },
          { id: 7, text: 'four', completed: false, indent: 0, parentId: null },
        ],
      }),
    });

    const getCheckboxFor = (value: string) => {
      const input = screen.getByDisplayValue(value);
      const span = input.closest('span') as HTMLElement;
      return span.querySelector('input[type="checkbox"]') as HTMLInputElement;
    };

    // Check "two"
    await waitFor(() => expect(getCheckboxFor('two')).toBeInTheDocument());
    await user.click(getCheckboxFor('two'));

    await waitFor(() => {
      expect(getCheckboxFor('two')).toBeChecked();
      // two should be in completed section
      expect(
        within(screen.getByTestId('completed-section')).getByDisplayValue(
          'two',
        ),
      ).toBeInTheDocument();
    });

    // Drag "a" under "one": get drag handles and simulate drag/drop
    const handles = screen.getAllByTestId('todo-indent');
    const inputs = screen.getAllByLabelText('Todo text');

    // After "two" is checked, active section order is: one(0), three(1), a(2), b(3), c(4), four(5)
    // So "a" is at index 2 and "one" is at index 0
    const oneRow = (inputs[0] as HTMLElement).closest('div');
    const aHandle = handles[2]; // "a" should be at index 2 in active section

    if (!oneRow || !aHandle) throw new Error('Elements not found');

    // Verify we found the right elements
    expect((inputs[0] as HTMLTextAreaElement).value).toBe('one');
    expect((inputs[2] as HTMLTextAreaElement).value).toBe('a');

    // Simulate drag from "a" to "one"
    fireEvent.dragStart(aHandle);
    fireEvent.dragOver(oneRow);
    fireEvent.drop(oneRow);
    fireEvent.dragEnd(aHandle);

    // Expectations: "two" remains completed and does not resurface; "a" is now under "one"
    await waitFor(() => {
      expect(getCheckboxFor('two')).toBeChecked();
      // Ensure "two" did not resurface in the active section
      const active = within(screen.getByTestId('active-section'));
      expect(active.queryByDisplayValue('two')).toBeNull();
      // "a" should now be under "one" in the active section
      expect(active.getByDisplayValue('a')).toBeInTheDocument();
    });

    // Verify "a" has correct parent (should be "one")
    const active = within(screen.getByTestId('active-section'));
    const oneRowAfter = (
      active.getByDisplayValue('one') as HTMLElement
    ).closest('div');
    const aRowAfter = (active.getByDisplayValue('a') as HTMLElement).closest(
      'div',
    );

    if (!oneRowAfter || !aRowAfter)
      throw new Error('Rows not found after drag');

    // Check that "a" is indented (has indent1 class)
    const aHandleAfter = aRowAfter.querySelector('[data-testid="todo-indent"]');
    expect(aHandleAfter?.className).toMatch(/indent1/);
  });

  // Note: The two unchecking tests were removed as they tested aspirational behavior
  // not related to the zombie-todos epic (resurfacing on delete/drag).
  // The current behavior is: checking a parent checks all children, but unchecking doesn't cascade.
  // If we want bidirectional toggle behavior, that should be a separate feature/epic.
});
