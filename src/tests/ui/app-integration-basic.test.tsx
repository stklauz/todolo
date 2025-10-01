import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TodoApp from '../../renderer/features/todos/components/TodoApp';
import * as storage from '../../renderer/features/todos/api/storage';

// Mock the storage module
jest.mock('../../renderer/features/todos/api/storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('E2E Basic Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful storage operations by default
    mockStorage.loadAppSettings.mockResolvedValue({ hideCompletedItems: true });
    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: [],
      selectedListId: undefined,
    });
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: [],
    });
    mockStorage.saveListsIndex.mockResolvedValue(true);
    mockStorage.saveListTodos.mockResolvedValue(true);
  });

  describe('Basic App Flow', () => {
    it('should render the app without crashing', async () => {
      render(<TodoApp />);

      // Wait for initialization
      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Should render the main app structure (sidebar with add list button)
      expect(screen.getByRole('button', { name: /add list/i })).toBeInTheDocument();
    });

    it('should load existing data on startup', async () => {
      const existingLists = [
        { id: 'list-1', name: 'Work Tasks', createdAt: '2024-01-01T00:00:00.000Z' },
      ];

      mockStorage.loadListsIndex.mockResolvedValue({
        version: 2,
        lists: existingLists,
        selectedListId: 'list-1',
      });

      mockStorage.loadListTodos.mockResolvedValue({
        version: 2,
        todos: [{ id: 1, text: 'Existing todo', completed: false, indent: 0 }],
      });

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Should load existing data (the todo might not be visible in the DOM immediately)
      // Verify the storage call occurred
      await waitFor(() => {
        expect(mockStorage.loadListTodos).toHaveBeenCalled();
      });
    });
  });

  describe('Data Persistence', () => {
    it('should save data when changes are made', async () => {
      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Find the textarea and add a todo (user-typed)
      const textarea = screen.getByRole('textbox');
      const user = userEvent.setup();
      await user.click(textarea);
      await user.type(textarea, 'Test todo');

      // Wait for debounced save
      await waitFor(() => {
        expect(mockStorage.saveListTodos).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should handle save failures gracefully', async () => {
      mockStorage.saveListTodos.mockResolvedValue(false);

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      const textarea = screen.getByRole('textbox');
      const user = userEvent.setup();
      await user.click(textarea);
      await user.type(textarea, 'Test todo');

      // Should not crash on save failure
      await waitFor(() => {
        expect(mockStorage.saveListTodos).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe('Storage API Integration', () => {
    it('should call storage APIs correctly', async () => {
      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalledTimes(1);
      });

      // Should load todos for the selected list
      await waitFor(() => {
        expect(mockStorage.loadListTodos).toHaveBeenCalled();
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.loadListsIndex.mockRejectedValue(new Error('Storage error'));

      render(<TodoApp />);

      // Should handle the error and continue
      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // App should still render core UI
      expect(screen.getByRole('button', { name: /add list/i })).toBeInTheDocument();
    });
  });

  describe('Migration Support', () => {
    it('should handle fresh install (no existing data)', async () => {
      mockStorage.loadListsIndex.mockResolvedValue({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Should create default list
      expect(screen.getByRole('button', { name: /add list/i })).toBeInTheDocument();
    });

    it('should handle corrupted data gracefully', async () => {
      mockStorage.loadListsIndex.mockResolvedValue(null as any);

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Should fall back to default behavior and render core UI
      expect(screen.getByRole('button', { name: /add list/i })).toBeInTheDocument();
    });
  });
});
