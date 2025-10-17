import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import * as storage from '../../features/todos/api/storage';
import {
  renderAppWithDefaults,
  setupDefaultMocks,
  mockStorage,
  setupUser,
} from '../../testUtils/ui';

// Mock the storage module
jest.mock('../../features/todos/api/storage');

describe('Todo Keyboard Interactions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Enter Key Behavior', () => {
    it('creates new todo when Enter is pressed on non-empty todo', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const input = screen.getByLabelText('Todo text');
      await user.click(input);
      await user.type(input, 'Buy milk');

      // Press Enter to create new todo
      await user.keyboard('{Enter}');

      // Should have 2 inputs now
      const allInputs = screen.getAllByLabelText('Todo text');
      expect(allInputs).toHaveLength(2);
      expect((allInputs[0] as HTMLTextAreaElement).value).toBe('Buy milk');
      expect((allInputs[1] as HTMLTextAreaElement).value).toBe('');

      // Focus should move to new input
      await waitFor(() => expect(allInputs[1]).toHaveFocus());
    });

    it('does nothing when Enter is pressed on empty todo', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const input = screen.getByLabelText('Todo text');
      await user.click(input);

      // Sanity: input is empty
      expect((input as HTMLTextAreaElement).value).toBe('');

      await user.keyboard('{Enter}');

      // Still only one input; Enter on empty should be a no-op
      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs).toHaveLength(1);
      expect(mockStorage.saveListTodos).not.toHaveBeenCalled();
      await waitFor(() => expect(inputs[0]).toHaveFocus());
    });

    it('creates new todo when Enter is pressed with completed items hidden', async () => {
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

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
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

      // Expected: ['Todo 1', 'Todo 2', 'Todo 4', 'Todo 5'] (Todo 3 is hidden)
      expect(visibleValues).toEqual(['Todo 1', 'Todo 2', 'Todo 4', 'Todo 5']);

      // Press Enter on the last visible todo (Todo 5)
      const lastInput = visibleInputs[3]; // Todo 5
      await user.click(lastInput);
      await user.keyboard('{Enter}');

      // Should now have 5 inputs - Enter should create a new todo when current is not empty
      await waitFor(() => {
        const inputs = screen.getAllByLabelText('Todo text');
        expect(inputs).toHaveLength(5);
      });

      // Verify the order is correct after the fix
      const finalInputs = screen.getAllByLabelText('Todo text');
      const finalValues = finalInputs.map(
        (input) => (input as HTMLTextAreaElement).value,
      );

      // Expected order: ['Todo 1', 'Todo 2', 'Todo 4', 'Todo 5', ''] (Todo 3 is hidden)
      expect(finalValues).toEqual(['Todo 1', 'Todo 2', 'Todo 4', 'Todo 5', '']);
    });
  });

  describe('Backspace Key Behavior', () => {
    it('deletes empty todo when Backspace is pressed', async () => {
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

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
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
      expect(visibleValues).toEqual(['Todo 1', 'Todo 3', '']);

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

    it('cannot delete the last remaining empty todo', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const input = screen.getByLabelText('Todo text');
      await user.click(input);

      // Backspace on empty when it's the only todo should do nothing
      await user.keyboard('{Backspace}');

      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs).toHaveLength(1);
      expect(mockStorage.saveListTodos).not.toHaveBeenCalled();

      // Checkbox remains disabled for the empty todo
      const checkbox = screen.getByRole('checkbox', {
        name: /toggle completed/i,
      });
      expect(checkbox).toBeDisabled();
    });

    it('outdents indented empty todo before deleting', async () => {
      // Setup with parent + empty indented child
      const initialTodos = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: '', completed: false, indent: 1 }, // Empty indented child
      ];

      const user = setupUser();
      renderAppWithDefaults({
        loadListTodos: jest.fn().mockResolvedValue({
          version: 2,
          todos: initialTodos,
        }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      // Two visible inputs (child is empty but still visible)
      const inputs = await screen.findAllByRole('textbox', {
        name: /todo text/i,
      });
      expect(inputs.length).toBe(2);

      // Focus the child (second input) and press Backspace
      await user.click(inputs[1]);
      await user.keyboard('{Backspace}');

      // After outdent: still two inputs
      const afterOutdent = await screen.findAllByRole('textbox', {
        name: /todo text/i,
      });
      expect(afterOutdent.length).toBe(2);

      // Press Backspace again to delete the now-unindented empty row
      await user.keyboard('{Backspace}');

      const afterDelete = await screen.findAllByRole('textbox', {
        name: /todo text/i,
      });
      expect(afterDelete.length).toBe(1);
    });
  });

  describe('Tab Key Behavior', () => {
    it('indents todo when Tab is pressed', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const input = screen.getByLabelText('Todo text');
      await user.click(input);
      await user.type(input, 'Test todo');

      // Press Tab to indent
      await user.keyboard('{Tab}');

      // Should save the indented todo
      await waitFor(() => {
        expect(mockStorage.saveListTodos).toHaveBeenCalled();
      });
    });

    it('outdents todo when Shift+Tab is pressed', async () => {
      // Setup with an indented todo
      const initialTodos = [
        { id: 1, text: 'Indented todo', completed: false, indent: 1 },
      ];

      const user = setupUser();
      renderAppWithDefaults({
        loadListTodos: jest.fn().mockResolvedValue({
          version: 2,
          todos: initialTodos,
        }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const input = screen.getByLabelText('Todo text');
      await user.click(input);

      // Press Shift+Tab to outdent
      await user.keyboard('{Shift>}{Tab}{/Shift}');

      // Should save the outdented todo
      await waitFor(() => {
        expect(mockStorage.saveListTodos).toHaveBeenCalled();
      });
    });
  });

  describe('Focus Management', () => {
    it('maintains focus after keyboard operations', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const input = screen.getByLabelText('Todo text');
      await user.click(input);
      await user.type(input, 'Test todo');

      // Press Enter
      await user.keyboard('{Enter}');

      // Focus should move to the new input
      const allInputs = screen.getAllByLabelText('Todo text');
      await waitFor(() => expect(allInputs[1]).toHaveFocus());
    });

    it('preserves focus when no operation occurs', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const input = screen.getByLabelText('Todo text');
      await user.click(input);

      // Press Enter on empty input (should do nothing)
      await user.keyboard('{Enter}');

      // Focus should remain on the same input
      await waitFor(() => expect(input).toHaveFocus());
    });
  });

  describe('Edge Cases', () => {
    it('handles keyboard operations with mixed completed/incomplete todos', async () => {
      const initialTodos = [
        { id: 1, text: 'Active 1', completed: false, indent: 0 },
        { id: 2, text: 'Completed', completed: true, indent: 0 }, // Hidden
        { id: 3, text: 'Active 2', completed: false, indent: 0 },
        { id: 4, text: '', completed: false, indent: 0 }, // Empty
      ];

      const user = setupUser();
      renderAppWithDefaults({
        loadListTodos: jest.fn().mockResolvedValue({
          version: 2,
          todos: initialTodos,
        }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      // Should see 3 visible todos (completed one is hidden)
      await waitFor(() => {
        const inputs = screen.getAllByLabelText('Todo text');
        expect(inputs).toHaveLength(3);
      });

      const inputs = screen.getAllByLabelText('Todo text');
      const values = inputs.map(
        (input) => (input as HTMLTextAreaElement).value,
      );
      expect(values).toEqual(['Active 1', 'Active 2', '']);

      // Test Enter on non-empty todo
      await user.click(inputs[0]);
      await user.keyboard('{Enter}');

      await waitFor(() => {
        const newInputs = screen.getAllByLabelText('Todo text');
        expect(newInputs).toHaveLength(4);
      });

      // Test Backspace on empty todo
      const newInputs = screen.getAllByLabelText('Todo text');
      await user.click(newInputs[3]); // The empty one
      await user.keyboard('{Backspace}');

      await waitFor(() => {
        const finalInputs = screen.getAllByLabelText('Todo text');
        expect(finalInputs).toHaveLength(3);
      });
    });

    it('handles rapid keyboard operations without breaking', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const input = screen.getByLabelText('Todo text');
      await user.click(input);

      // Rapid operations - need to wait for focus changes
      await user.type(input, 'Todo 1');
      await user.keyboard('{Enter}');

      // Wait for new input to be created and focused
      await waitFor(() => {
        const inputs = screen.getAllByLabelText('Todo text');
        expect(inputs).toHaveLength(2);
      });

      const inputs = screen.getAllByLabelText('Todo text');
      await user.type(inputs[1], 'Todo 2');
      await user.keyboard('{Enter}');

      // Wait for another new input
      await waitFor(() => {
        const newInputs = screen.getAllByLabelText('Todo text');
        expect(newInputs).toHaveLength(3);
      });

      const finalInputs = screen.getAllByLabelText('Todo text');
      await user.type(finalInputs[2], 'Todo 3');

      // Should have 3 todos with correct values
      const values = finalInputs.map(
        (finalInput) => (finalInput as HTMLTextAreaElement).value,
      );
      expect(values).toEqual(['Todo 1', 'Todo 2', 'Todo 3']);
    });
  });
});
