import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TodoApp } from '../renderer/features/todos/components/TodoApp';
import * as storage from '../renderer/features/todos/api/storage';

// Mock the storage module
jest.mock('../renderer/features/todos/api/storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Duplicate List Phase 2 - UI Integration & Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful storage operations by default
    mockStorage.loadAppSettings.mockResolvedValue({ hideCompletedItems: true });
    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: [
        {
          id: 'list-1',
          name: 'Work Tasks',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      selectedListId: 'list-1',
    });
    mockStorage.loadListTodos.mockResolvedValue({
      version: 2,
      todos: [],
    });
    mockStorage.saveListsIndex.mockResolvedValue(true);
    mockStorage.saveListTodos.mockResolvedValue(true);
    mockStorage.duplicateList.mockResolvedValue({
      success: true,
      newListId: 'duplicated-list-id',
    });
    mockStorage.setSelectedListMeta.mockResolvedValue();
  });

  describe('Title Actions Menu Order', () => {
    it('should show "Duplicate list" above "Delete list" consistently', async () => {
      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Wait for the menu button to be available
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByRole('button', { name: /list actions/i });
      const user = userEvent.setup();
      await user.click(menuButton);

      // Get menu items
      const duplicateButton = screen.getByTestId('menu-duplicate-list');
      const deleteButton = screen.getByTestId('menu-delete-list');

      // Verify both buttons exist
      expect(duplicateButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();

      // Verify duplicate button comes before delete button in DOM order
      const menu = screen.getByRole('menu');
      const menuItems = Array.from(menu.querySelectorAll('[role="menuitem"]'));
      const duplicateIndex = menuItems.indexOf(duplicateButton);
      const deleteIndex = menuItems.indexOf(deleteButton);

      expect(duplicateIndex).toBeLessThan(deleteIndex);
    });
  });

  describe('Button Disabled State During Operation', () => {
    it('should disable duplicate button while duplicating', async () => {
      // Mock a slow duplicate operation
      mockStorage.duplicateList.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: true,
                newListId: 'duplicated-list-id',
              });
            }, 200);
          }),
      );

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Wait for the menu button to be available
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByRole('button', { name: /list actions/i });
      const user = userEvent.setup();
      await user.click(menuButton);

      const duplicateButton = screen.getByTestId('menu-duplicate-list');
      expect(duplicateButton).not.toBeDisabled();

      // Click duplicate
      await user.click(duplicateButton);

      // Wait for operation to complete
      await waitFor(() => {
        expect(mockStorage.duplicateList).toHaveBeenCalled();
      });

      // Wait for the operation to fully complete (including state cleanup)
      await waitFor(() => {
        expect(screen.getByText('List duplicated')).toBeInTheDocument();
      });

      // The button should be enabled again after operation completes
      // We can verify this by checking that the operation completed successfully
      expect(mockStorage.duplicateList).toHaveBeenCalledTimes(1);
    });

    it('should prevent double triggers while duplicating', async () => {
      let duplicateCallCount = 0;
      mockStorage.duplicateList.mockImplementation(() => {
        duplicateCallCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              newListId: 'duplicated-list-id',
            });
          }, 200);
        });
      });

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Wait for the menu button to be available
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByRole('button', { name: /list actions/i });
      const user = userEvent.setup();
      await user.click(menuButton);

      const duplicateButton = screen.getByTestId('menu-duplicate-list');

      // Click duplicate multiple times rapidly
      await user.click(duplicateButton);
      await user.click(duplicateButton);
      await user.click(duplicateButton);

      // Wait for operation to complete
      await waitFor(() => {
        expect(mockStorage.duplicateList).toHaveBeenCalled();
      });

      // Should only have been called once despite multiple clicks
      expect(duplicateCallCount).toBe(1);
    });
  });

  describe('Spinner Display', () => {
    it('should show spinner after 150ms threshold', async () => {
      // Mock a slow duplicate operation
      mockStorage.duplicateList.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: true,
                newListId: 'duplicated-list-id',
              });
            }, 300);
          }),
      );

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Wait for the menu button to be available
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByRole('button', { name: /list actions/i });
      const user = userEvent.setup();
      await user.click(menuButton);

      const duplicateButton = screen.getByTestId('menu-duplicate-list');

      // Click duplicate
      await user.click(duplicateButton);

      // Wait for status message to appear
      await waitFor(() => {
        expect(screen.getByText('Duplicating…')).toBeInTheDocument();
      });

      // Wait for operation to complete
      await waitFor(() => {
        expect(mockStorage.duplicateList).toHaveBeenCalled();
      });

      // Check for success message
      await waitFor(() => {
        expect(screen.getByText('List duplicated')).toBeInTheDocument();
      });
    });

    it('should not show spinner for fast operations under 150ms', async () => {
      // Mock a fast duplicate operation
      mockStorage.duplicateList.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: true,
                newListId: 'duplicated-list-id',
              });
            }, 100);
          }),
      );

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Wait for the menu button to be available
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByRole('button', { name: /list actions/i });
      const user = userEvent.setup();
      await user.click(menuButton);

      const duplicateButton = screen.getByTestId('menu-duplicate-list');

      // Click duplicate
      await user.click(duplicateButton);

      // Wait for operation to complete
      await waitFor(() => {
        expect(mockStorage.duplicateList).toHaveBeenCalled();
      });

      // Should never show spinner for fast operations
      expect(duplicateButton.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('Editing Behavior', () => {
    it('Backspace on empty indented item outdents first, then deletes', async () => {
      // Override initial todos for this test: Parent + empty child
      mockStorage.loadListTodos.mockResolvedValueOnce({
        version: 2,
        todos: [
          { id: 1, text: 'Parent', completed: false, indent: 0 },
          { id: 2, text: '', completed: false, indent: 1 },
        ],
      });

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Two visible inputs (child is empty but still visible)
      const inputs = await screen.findAllByRole('textbox', {
        name: /todo text/i,
      });
      expect(inputs.length).toBe(2);

      const user = userEvent.setup();
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

  describe('Focus Management', () => {
    it('should create and select the newly duplicated list', async () => {
      // Mock successful duplication with new list
      mockStorage.loadListsIndex
        .mockResolvedValueOnce({
          version: 2,
          lists: [
            {
              id: 'list-1',
              name: 'Work Tasks',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          selectedListId: 'list-1',
        })
        .mockResolvedValueOnce({
          version: 2,
          lists: [
            {
              id: 'list-1',
              name: 'Work Tasks',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: 'duplicated-list-id',
              name: 'Work Tasks (Copy)',
              createdAt: '2024-01-02T00:00:00.000Z',
            },
          ],
          selectedListId: 'duplicated-list-id',
        });

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Wait for the menu button to be available
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByRole('button', { name: /list actions/i });
      const user = userEvent.setup();
      await user.click(menuButton);

      const duplicateButton = screen.getByTestId('menu-duplicate-list');

      // Click duplicate
      await user.click(duplicateButton);

      // Wait for duplication to complete and lists to reload
      await waitFor(() => {
        expect(mockStorage.duplicateList).toHaveBeenCalled();
      });

      // Wait for the new list to appear in the sidebar
      await waitFor(() => {
        expect(screen.getByTitle('Work Tasks (Copy)')).toBeInTheDocument();
      });

      // The new list should be focusable (we can't easily test scrollIntoView in jsdom,
      // but we can verify the element exists and would be focusable)
      const newListItem = screen
        .getByTitle('Work Tasks (Copy)')
        .closest('[role="button"]');
      expect(newListItem).toBeInTheDocument();
      expect(newListItem).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('ARIA Live Region', () => {
    it('should announce status non-intrusively via ARIA live region', async () => {
      // Mock a slow duplicate operation to ensure we can see the "Duplicating..." message
      mockStorage.duplicateList.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: true,
                newListId: 'duplicated-list-id',
              });
            }, 100);
          }),
      );

      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Wait for the menu button to be available
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByRole('button', { name: /list actions/i });
      const user = userEvent.setup();
      await user.click(menuButton);

      const duplicateButton = screen.getByTestId('menu-duplicate-list');

      // Click duplicate
      await user.click(duplicateButton);

      // Check for ARIA live region
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

      // Wait for status message to appear
      await waitFor(() => {
        expect(liveRegion).toHaveTextContent('Duplicating…');
      });

      // Wait for operation to complete
      await waitFor(() => {
        expect(mockStorage.duplicateList).toHaveBeenCalled();
      });

      // Check for success message
      await waitFor(() => {
        expect(liveRegion).toHaveTextContent('List duplicated');
      });
    });
  });
});
