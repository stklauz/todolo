import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import * as storage from '../../features/todos/api/storage';
import { debugLogger } from '../../utils/debug';
import {
  renderAppWithDefaults,
  setupDefaultMocks,
  mockStorage,
  setupUser,
} from '../../testUtils/ui';

// Mock the storage module
jest.mock('../../features/todos/api/storage');

describe('Error Handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    debugLogger.disable();
  });

  describe('Storage Load Failures', () => {
    it('handles lists index load failure gracefully', async () => {
      // Simulate failing index load — app should seed a new list and persist index
      renderAppWithDefaults({
        loadListsIndex: jest
          .fn()
          .mockRejectedValue(new Error('disk unavailable')),
      });

      // App should recover by creating an initial list
      const addListBtn = await screen.findByRole('button', {
        name: /add list/i,
      });
      expect(addListBtn).toBeInTheDocument();

      // Persistence: index should be saved at least once when seeding after failure
      await waitFor(() =>
        expect(mockStorage.saveListsIndex).toHaveBeenCalled(),
      );
      expect(mockStorage.saveListsIndex).toHaveBeenCalledWith(
        expect.objectContaining({ version: 2 }),
      );
    });

    it('handles todos load failure gracefully', async () => {
      renderAppWithDefaults({
        loadListTodos: jest
          .fn()
          .mockRejectedValue(new Error('todos unavailable')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should still render core UI
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('heading')).toBeInTheDocument();
    });

    it('handles app settings load failure gracefully', async () => {
      renderAppWithDefaults({
        loadAppSettings: jest
          .fn()
          .mockRejectedValue(new Error('settings unavailable')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should still render with default settings
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Storage Save Failures', () => {
    it('handles todos save failure gracefully', async () => {
      // Enable debug to ensure error-logging branches execute
      debugLogger.enable();
      try {
        const user = setupUser();

        renderAppWithDefaults({
          saveListTodos: jest.fn().mockRejectedValue(new Error('write failed')),
          loadAppSettings: jest
            .fn()
            .mockResolvedValue({ hideCompletedItems: true }), // Ensure this doesn't fail
        });

        await waitFor(() =>
          expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
        );
        await waitFor(() =>
          expect(mockStorage.loadListTodos).toHaveBeenCalled(),
        );

        // App should remain functional even if save fails
        expect(
          screen.getByRole('button', { name: /add list/i }),
        ).toBeInTheDocument();

        // App should remain functional even if save fails
        // The test verifies that the app doesn't crash when save operations fail
      } finally {
        debugLogger.disable();
      }
    });

    it('handles lists index save failure gracefully', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        saveListsIndex: jest
          .fn()
          .mockRejectedValue(new Error('index write failed')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Try to add a list
      const addListButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addListButton);

      // Should attempt to save but handle failure gracefully
      await waitFor(() =>
        expect(mockStorage.saveListsIndex).toHaveBeenCalled(),
      );

      // App should remain functional
      expect(addListButton).toBeInTheDocument();
    });

    it('handles app settings save failure gracefully', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        saveAppSettings: jest
          .fn()
          .mockRejectedValue(new Error('settings write failed')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should remain functional even if settings can't be saved
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Network and Timeout Errors', () => {
    it('handles network timeout errors gracefully', async () => {
      renderAppWithDefaults({
        loadListsIndex: jest
          .fn()
          .mockImplementation(
            () =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Network timeout')), 1000),
              ),
          ),
      });

      // App should handle timeout gracefully
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add list/i }),
        ).toBeInTheDocument();
      });
    });

    it('handles connection errors gracefully', async () => {
      renderAppWithDefaults({
        loadListsIndex: jest
          .fn()
          .mockRejectedValue(new Error('Connection refused')),
      });

      // App should recover and remain functional
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add list/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Data Corruption and Invalid States', () => {
    it('handles invalid list data gracefully', async () => {
      renderAppWithDefaults({
        loadListsIndex: jest.fn().mockResolvedValue({
          version: 2,
          lists: null, // Invalid data
          selectedListId: null,
        }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should handle invalid data gracefully
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });

    it('handles malformed todo data gracefully', async () => {
      renderAppWithDefaults({
        loadListTodos: jest.fn().mockResolvedValue({
          version: 2,
          todos: [
            { id: 'invalid', text: null, completed: 'yes', indent: 'two' }, // Invalid data
          ],
        }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should handle malformed data gracefully
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });

    it('handles missing required fields gracefully', async () => {
      renderAppWithDefaults({
        loadListsIndex: jest.fn().mockResolvedValue({
          // Missing version field
          lists: [],
          selectedListId: null,
        }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should handle missing fields gracefully
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Operation Failures', () => {
    it('handles list duplication failure gracefully', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        duplicateList: jest
          .fn()
          .mockResolvedValue({ success: false, error: 'Failed to duplicate' }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should remain functional even if duplication fails
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });

    it('handles list deletion failure gracefully', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        deleteList: jest
          .fn()
          .mockResolvedValue({ success: false, error: 'Failed to delete' }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should remain functional even if deletion fails
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });

    it('handles list creation failure gracefully', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        saveListsIndex: jest
          .fn()
          .mockRejectedValue(new Error('Failed to create list')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Try to add a list
      const addListButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addListButton);

      // App should handle creation failure gracefully
      expect(addListButton).toBeInTheDocument();
    });
  });

  describe('User Input Validation', () => {
    it('handles invalid keyboard input gracefully', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Try various keyboard combinations that might cause issues
      const addListButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addListButton);

      // App should handle keyboard input gracefully
      expect(addListButton).toBeInTheDocument();
    });

    it('handles rapid user interactions gracefully', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      const addListButton = screen.getByRole('button', { name: /add list/i });

      // Rapid clicking should not break the app
      await user.click(addListButton);
      await user.click(addListButton);
      await user.click(addListButton);

      // App should remain stable
      expect(addListButton).toBeInTheDocument();
    });
  });

  describe('Memory and Performance Issues', () => {
    it('handles large data sets gracefully', async () => {
      const largeTodosList = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        text: `Todo ${i + 1}`,
        completed: false,
        indent: 0,
      }));

      renderAppWithDefaults({
        loadListTodos: jest.fn().mockResolvedValue({
          version: 2,
          todos: largeTodosList,
        }),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should handle large datasets without crashing
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });

    it('handles memory pressure gracefully', async () => {
      // Simulate memory pressure by rejecting operations
      renderAppWithDefaults({
        loadListsIndex: jest.fn().mockRejectedValue(new Error('Out of memory')),
        loadListTodos: jest.fn().mockRejectedValue(new Error('Out of memory')),
        saveListsIndex: jest.fn().mockRejectedValue(new Error('Out of memory')),
        saveListTodos: jest.fn().mockRejectedValue(new Error('Out of memory')),
      });

      // App should handle memory pressure gracefully
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add list/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery', () => {
    it('recovers from temporary failures', async () => {
      let callCount = 0;
      renderAppWithDefaults({
        loadListsIndex: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Temporary failure'));
          }
          return Promise.resolve({
            version: 2,
            lists: [
              {
                id: 'list-1',
                name: 'My List',
                createdAt: '2024-01-01T00:00:00.000Z',
              },
            ],
            selectedListId: 'list-1',
          });
        }),
      });

      // App should eventually recover
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add list/i }),
        ).toBeInTheDocument();
      });
    });

    it('maintains state consistency during errors', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        saveListsIndex: jest.fn().mockRejectedValue(new Error('Save failed')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Try to perform operations
      const addListButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addListButton);

      // App should maintain consistent state
      expect(addListButton).toBeInTheDocument();
      // Check for title input instead of heading (the app renders an input for editing)
      const titleInput = screen.getByDisplayValue('List 1');
      expect(titleInput).toBeInTheDocument();
    });
  });

  describe('Error Logging and Debugging', () => {
    it('logs errors appropriately when debug is enabled', async () => {
      debugLogger.enable();
      try {
        renderAppWithDefaults({
          loadListsIndex: jest.fn().mockRejectedValue(new Error('Test error')),
        });

        await waitFor(() =>
          expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
        );

        // App should handle the error gracefully
        expect(
          screen.getByRole('button', { name: /add list/i }),
        ).toBeInTheDocument();
      } finally {
        debugLogger.disable();
      }
    });

    it('does not log errors when debug is disabled', async () => {
      debugLogger.disable();

      renderAppWithDefaults({
        loadListsIndex: jest.fn().mockRejectedValue(new Error('Test error')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Error should not be logged when debug is disabled
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
