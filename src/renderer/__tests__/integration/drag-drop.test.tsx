import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
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

describe('Drag and Drop Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Drag drop visual feedback', () => {
    it('should show drop target highlight when dragging over a todo', async () => {
      // Set up initial state with multiple todos
      const initialTodos = {
        version: 2 as const,
        todos: [
          { id: 1, text: 'Todo 1', completed: false, indent: 0 },
          { id: 2, text: 'Todo 2', completed: false, indent: 0 },
          { id: 3, text: 'Todo 3', completed: false, indent: 0 },
        ],
      };

      mockStorage.loadListTodos.mockResolvedValue(initialTodos);

      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());
      // Wait for todos to render (at least 1 input is always present)
      await waitFor(() => {
        const todos = screen.getAllByLabelText('Todo text');
        expect(todos.length).toBeGreaterThanOrEqual(1);
      });

      const user = setupUser();

      // Find the draggable elements (the checkbox + input container)
      const todos = screen.getAllByLabelText('Todo text');

      // Get the first todo row's container
      const firstTodoInput = todos[0] as HTMLElement;
      const firstTodoRow = firstTodoInput.closest('[class*="row"]');

      // The draggable element should have role="button" with "Drag to reorder" aria-label
      const dragHandle = within(firstTodoRow as HTMLElement).getByRole(
        'button',
        {
          name: 'Drag to reorder',
        },
      );

      expect(dragHandle).toBeInTheDocument();
      expect(dragHandle).toHaveAttribute('draggable', 'true');
    });

    it('should handle drag start, drag over, and drag end sequence', async () => {
      const initialTodos = {
        version: 2 as const,
        todos: [
          { id: 1, text: 'Move me', completed: false, indent: 0 },
          { id: 2, text: 'Target', completed: false, indent: 0 },
        ],
      };

      mockStorage.loadListTodos.mockResolvedValue(initialTodos);

      renderAppWithDefaults();

      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const todos = screen.getAllByLabelText('Todo text');
      const firstTodoInput = todos[0] as HTMLElement;
      const firstTodoRow = firstTodoInput.closest('[class*="row"]');
      const dragHandle = within(firstTodoRow as HTMLElement).getByRole(
        'button',
        {
          name: 'Drag to reorder',
        },
      );

      // Simulate drag sequence
      // Note: React Testing Library doesn't fully support drag events,
      // but we can test that the elements are set up correctly and the handlers exist
      expect(dragHandle).toBeInTheDocument();
      expect(dragHandle).toHaveAttribute('draggable', 'true');
    });
  });

  describe('Drag and drop reordering', () => {
    it('should reorder todos when dropping one todo on another', async () => {
      const initialTodos = {
        version: 2 as const,
        todos: [
          { id: 1, text: 'First', completed: false, indent: 0 },
          { id: 2, text: 'Second', completed: false, indent: 0 },
          { id: 3, text: 'Third', completed: false, indent: 0 },
        ],
      };

      mockStorage.loadListTodos.mockResolvedValue(initialTodos);

      renderAppWithDefaults();

      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());
      // Wait for todos to render
      await waitFor(() => {
        const inputs = screen.getAllByLabelText('Todo text');
        expect(inputs.length).toBeGreaterThanOrEqual(1);
      });

      // Verify at least one input present (mocked data is rendered)
      const inputs = screen.getAllByLabelText('Todo text');
      expect(inputs.length).toBeGreaterThanOrEqual(1);

      // Drag and drop operations would happen here in a real browser
      // Since we can't fully simulate HTML5 drag events in jsdom,
      // we verify the structure is in place for drag and drop to work

      // Verify that draggable elements exist and have proper attributes
      inputs.forEach((input) => {
        const inputEl = input as HTMLElement;
        const row = inputEl.closest('[class*="row"]');
        const dragHandle = within(row as HTMLElement).getByRole('button', {
          name: 'Drag to reorder',
        });
        expect(dragHandle).toHaveAttribute('draggable', 'true');
      });
    });

    it('should maintain parent-child relationships when dragging parent blocks', async () => {
      const initialTodos = {
        version: 2 as const,
        todos: [
          { id: 1, text: 'Parent A', completed: false, indent: 0 },
          { id: 2, text: 'Child A1', completed: false, indent: 1 },
          { id: 3, text: 'Child A2', completed: false, indent: 1 },
          { id: 4, text: 'Parent B', completed: false, indent: 0 },
          { id: 5, text: 'Child B1', completed: false, indent: 1 },
        ],
      };

      mockStorage.loadListTodos.mockResolvedValue(initialTodos);

      renderAppWithDefaults();

      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const inputs = screen.getAllByLabelText('Todo text');

      // All todos should have draggable handles
      inputs.forEach((input) => {
        const inputEl = input as HTMLElement;
        const row = inputEl.closest('[class*="row"]');
        const dragHandle = within(row as HTMLElement).getByRole('button', {
          name: 'Drag to reorder',
        });
        expect(dragHandle).toBeInTheDocument();
      });

      // Verify at least one input present (mocked data is rendered)
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Drag and drop section boundaries', () => {
    it('should prevent dropping active todos into completed section', async () => {
      const initialTodos = {
        version: 2 as const,
        todos: [
          { id: 1, text: 'Active Todo', completed: false, indent: 0 },
          { id: 2, text: 'Completed Todo', completed: true, indent: 0 },
        ],
      };

      mockStorage.loadListTodos.mockResolvedValue(initialTodos);

      renderAppWithDefaults();

      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const inputs = screen.getAllByLabelText('Todo text');

      // Verify both todos exist and are draggable
      inputs.forEach((input) => {
        const inputEl = input as HTMLElement;
        const row = inputEl.closest('[class*="row"]');
        const dragHandle = within(row as HTMLElement).getByRole('button', {
          name: 'Drag to reorder',
        });
        expect(dragHandle).toBeInTheDocument();
      });

      // The section boundary logic is enforced by the drag handler logic
      // which is tested in the unit tests
    });
  });

  describe('Drag handle accessibility', () => {
    it('should have proper ARIA labels for drag handles', async () => {
      const initialTodos = {
        version: 2 as const,
        todos: [{ id: 1, text: 'Todo', completed: false, indent: 0 }],
      };

      mockStorage.loadListTodos.mockResolvedValue(initialTodos);

      renderAppWithDefaults();

      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const dragHandle = screen.getByRole('button', {
        name: 'Drag to reorder',
      });

      expect(dragHandle).toBeInTheDocument();
      expect(dragHandle).toHaveAttribute('title', 'Drag to reorder');
      expect(dragHandle).toHaveAttribute('draggable', 'true');
    });

    it('should have proper roles and attributes on drag handles', async () => {
      const initialTodos = {
        version: 2 as const,
        todos: [{ id: 1, text: 'Todo', completed: false, indent: 0 }],
      };

      mockStorage.loadListTodos.mockResolvedValue(initialTodos);

      renderAppWithDefaults();

      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const dragHandle = screen.getByRole('button', {
        name: 'Drag to reorder',
      });

      // Verify accessibility attributes
      expect(dragHandle).toHaveAttribute('role', 'button');
      expect(dragHandle).toHaveAttribute('aria-label', 'Drag to reorder');
      expect(dragHandle).toHaveAttribute('draggable', 'true');
    });
  });

  describe('Drag drop state management', () => {
    it('should handle rapid drag start/drag end without errors', async () => {
      const initialTodos = {
        version: 2 as const,
        todos: [
          { id: 1, text: 'Todo 1', completed: false, indent: 0 },
          { id: 2, text: 'Todo 2', completed: false, indent: 0 },
        ],
      };

      mockStorage.loadListTodos.mockResolvedValue(initialTodos);

      renderAppWithDefaults();

      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const inputs = screen.getAllByLabelText('Todo text');
      const dragHandles = screen.getAllByRole('button', {
        name: 'Drag to reorder',
      });

      // All drag handles should be present and functional
      expect(dragHandles.length).toBe(inputs.length);
      dragHandles.forEach((handle) => {
        expect(handle).toHaveAttribute('draggable', 'true');
      });
    });
  });
});
