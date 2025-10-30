import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
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

  it.skip('unchecking a parent should not uncheck all its children', async () => {
    renderAppWithDefaults({
      loadAppSettings: jest
        .fn()
        .mockResolvedValue({ hideCompletedItems: false }),
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'Parent', completed: true, indent: 0 },
          { id: 2, text: 'Child 1', completed: true, indent: 1 },
          { id: 3, text: 'Child 2', completed: true, indent: 1 },
        ],
      }),
    });

    // unchecking a parent should not uncheck all its children
    const getBoxes = () =>
      screen.getAllByRole('checkbox', { name: /toggle completed/i });
    await waitFor(() => expect(getBoxes().length).toBe(3));
    let [parent, child1, child2] = getBoxes();

    await user.click(parent);
    await waitFor(() => {
      [parent, child1, child2] = getBoxes();
      expect(parent).not.toBeChecked();
      expect(child1).toBeChecked();
      expect(child2).toBeChecked();
    });
  });

  it.skip('unchecking a completed child should uncheck its parent', async () => {
    renderAppWithDefaults({
      loadAppSettings: jest
        .fn()
        .mockResolvedValue({ hideCompletedItems: false }),
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'Parent', completed: true, indent: 0 },
          { id: 2, text: 'Child 1', completed: true, indent: 1 },
          { id: 3, text: 'Child 2', completed: true, indent: 1 },
        ],
      }),
    });

    // unchecking a parent should not uncheck all its children
    const getBoxes = () =>
      screen.getAllByRole('checkbox', { name: /toggle completed/i });
    await waitFor(() => expect(getBoxes().length).toBe(3));
    let [parent, child1, child2] = getBoxes();

    await user.click(child2);
    await waitFor(() => {
      [parent, child1, child2] = getBoxes();
      expect(parent).not.toBeChecked();
      expect(child1).toBeChecked();
      expect(child2).not.toBeChecked();
    });
  });

  it.skip('parent promotion on delete', async () => {
    renderAppWithDefaults({
      loadAppSettings: jest
        .fn()
        .mockResolvedValue({ hideCompletedItems: false }),
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'Parent 1', completed: false, indent: 0 },
          { id: 2, text: 'Parent 2', completed: false, indent: 0 },
          { id: 3, text: 'Parent 3', completed: false, indent: 0 },
          { id: 4, text: 'Child 1', completed: false, indent: 1 },
        ],
      }),
    });

    // check parent 2
    const getBoxes = () =>
      screen.getAllByRole('checkbox', { name: /toggle completed/i });
    const getCheckboxFor = (value: string) => {
      const input = screen.getByDisplayValue(value);
      const span = input.closest('span') as HTMLElement;
      return span.querySelector('input[type="checkbox"]') as HTMLInputElement;
    };
    await waitFor(() => expect(getBoxes().length).toBe(4));

    await user.click(getCheckboxFor('Parent 2'));
    await waitFor(() => {
      expect(getCheckboxFor('Parent 1')).not.toBeChecked();
      expect(getCheckboxFor('Parent 2')).toBeChecked();
      expect(getCheckboxFor('Parent 3')).not.toBeChecked();
      expect(getCheckboxFor('Child 1')).not.toBeChecked();

      expect(
        within(screen.getByTestId('completed-section')).getByDisplayValue(
          'Parent 2',
        ),
      ).toBeInTheDocument();
    });

    // delete parent 3: clear its text and press Backspace on empty input
    const inputParent3 = screen.getByDisplayValue(
      'Parent 3',
    ) as HTMLTextAreaElement;
    await user.click(inputParent3);
    await user.clear(inputParent3);
    await user.keyboard('{Backspace}');

    await waitFor(() => {
      // Parent 3 removed and Child 1 reparented under Parent 2
      expect(screen.queryByDisplayValue('Parent 3')).not.toBeInTheDocument();
      expect(getCheckboxFor('Parent 1')).not.toBeChecked();
      expect(getCheckboxFor('Parent 2')).toBeChecked();
      expect(getCheckboxFor('Child 1')).not.toBeChecked();
      expect(
        within(screen.getByTestId('completed-section')).getByDisplayValue(
          'Parent 2',
        ),
      ).toBeInTheDocument();
    });
  });
});
