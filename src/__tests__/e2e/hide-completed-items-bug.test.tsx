import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import * as storage from '../../renderer/features/todos/api/storage';
import {
  renderAppWithDefaults,
  setupDefaultMocks,
  mockStorage,
  setupUser,
} from '../../renderer/testUtils/ui';

// Mock the storage module
jest.mock('../../renderer/features/todos/api/storage');

describe('Hide Completed Items + Enter Key Bug', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reproduces the bug: Enter key fails to add new todo when completed items are hidden', async () => {
    // Setup with 5 todos where the 3rd one is completed
    const initialTodos = [
      { id: 1, text: 'Todo 1', completed: false, indent: 0 },
      { id: 2, text: 'Todo 2', completed: false, indent: 0 },
      { id: 3, text: 'Todo 3', completed: true, indent: 0 }, // This will be hidden
      { id: 4, text: 'Todo 4', completed: false, indent: 0 },
      { id: 5, text: 'Todo 5', completed: false, indent: 0 },
    ];

    const user = setupUser();
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: initialTodos,
      }),
    });

    // Wait for initialization
    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    // Verify we start with 4 visible todos (Todo 3 is hidden)
    await waitFor(() => {
      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs).toHaveLength(4);
    });

    const visibleInputs = screen.getAllByLabelText('Todo text');
    const visibleValues = visibleInputs.map(
      (input) => (input as HTMLTextAreaElement).value,
    );
    console.log('Initial visible todos:', visibleValues);

    // Expected: ['Todo 1', 'Todo 2', 'Todo 4', 'Todo 5'] (Todo 3 is hidden)

    // Step 1: Try to press Enter on the last visible todo (Todo 5)
    const lastInput = visibleInputs[3]; // Todo 5
    await user.click(lastInput);

    // This SHOULD create a new todo because the current todo is not empty
    const inputsBeforeEnter = screen.getAllByLabelText('Todo text');
    expect(inputsBeforeEnter).toHaveLength(4);

    await user.keyboard('{Enter}');

    // Should now have 5 inputs - Enter should create a new todo when current is not empty
    await waitFor(() => {
      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs).toHaveLength(5);
    });

    // Step 2: Verify the order is correct after the fix
    const finalInputs = screen.getAllByLabelText('Todo text');
    const finalValues = finalInputs.map(
      (input) => (input as HTMLTextAreaElement).value,
    );

    // Expected order: ['Todo 1', 'Todo 2', 'Todo 4', 'Todo 5', ''] (Todo 3 is hidden)
    // The new empty todo should be inserted after Todo 5 (the last visible todo)
    expect(finalValues).toEqual(['Todo 1', 'Todo 2', 'Todo 4', 'Todo 5', '']);
  });

  it('correctly removes todos via Backspace when completed items are hidden', async () => {
    // Setup with 4 todos where the 2nd one is completed
    const initialTodos = [
      { id: 1, text: 'Todo 1', completed: false, indent: 0 },
      { id: 2, text: 'Todo 2', completed: true, indent: 0 }, // This will be hidden
      { id: 3, text: 'Todo 3', completed: false, indent: 0 },
      { id: 4, text: '', completed: false, indent: 0 }, // Empty todo to delete
    ];

    const user = setupUser();
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: initialTodos,
      }),
    });

    // Wait for initialization
    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    // Verify we start with 3 visible todos (Todo 2 is hidden)
    await waitFor(() => {
      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs).toHaveLength(3);
    });

    const visibleInputs = screen.getAllByLabelText('Todo text');
    const visibleValues = visibleInputs.map(
      (input) => (input as HTMLTextAreaElement).value,
    );

    // Expected: ['Todo 1', 'Todo 3', ''] (Todo 2 is hidden)

    // Click on the empty todo (last visible) and press Backspace to delete it
    const lastInput = visibleInputs[2]; // Empty todo
    await user.click(lastInput);
    await user.keyboard('{Backspace}');

    // This should remove the empty todo
    await waitFor(() => {
      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs).toHaveLength(2);
    });

    // Verify the order - should be ['Todo 1', 'Todo 3'] (Todo 2 is hidden)
    const finalInputs = screen.getAllByLabelText('Todo text');
    const finalValues = finalInputs.map(
      (input) => (input as HTMLTextAreaElement).value,
    );

    expect(finalValues).toEqual(['Todo 1', 'Todo 3']);
  });

  it('creates new todo when completing the last active todo', async () => {
    // Setup with 2 todos where the 1st one is completed
    const initialTodos = [
      { id: 1, text: 'Todo 1', completed: true, indent: 0 }, // This will be hidden
      { id: 2, text: 'Todo 2', completed: false, indent: 0 }, // The only active, non-empty todo
    ];

    const user = setupUser();
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: initialTodos,
      }),
    });

    // Wait for initialization
    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    // Verify we start with 1 visible todo (Todo 1 is hidden)
    await waitFor(() => {
      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs).toHaveLength(1);
    });

    const visibleInputs = screen.getAllByLabelText('Todo text');
    const visibleValues = visibleInputs.map(
      (input) => (input as HTMLTextAreaElement).value,
    );

    // Expected: ['Todo 2'] (Todo 1 is hidden)

    // Toggle Todo 2 (the only active, non-empty todo)
    const todo2Checkbox = screen.getAllByRole('checkbox', {
      name: /toggle completed/i,
    })[0]; // Todo 2
    await user.click(todo2Checkbox);

    // This should create a new empty todo after Todo 2, but Todo 2 becomes hidden
    // The new empty todo should be visible since it's not completed
    await waitFor(() => {
      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs).toHaveLength(1);
    });

    // Verify the order - should be [''] (Todo 1 and Todo 2 are hidden)
    const finalInputs = screen.getAllByLabelText('Todo text');
    const finalValues = finalInputs.map(
      (input) => (input as HTMLTextAreaElement).value,
    );

    expect(finalValues).toEqual(['']);
  });
});
