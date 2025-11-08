import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TodoApp } from '../../features/todos/components/TodoApp';
import * as storage from '../../features/todos/api/storage';

// Mock the storage module to observe calls from UI to storage and assert IPC wiring
jest.mock('../../features/todos/api/storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('List Mutations - UI to DB wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.loadAppSettings.mockResolvedValue({ hideCompletedItems: true });
    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: [
        {
          id: 'list-a',
          name: 'Alpha',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'list-b',
          name: 'Beta',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      selectedListId: 'list-a',
    });
    mockStorage.loadListTodos.mockResolvedValue({ version: 3, todos: [] });
    mockStorage.saveListsIndex.mockResolvedValue(true);
    mockStorage.saveListTodos.mockResolvedValue(true);
    mockStorage.deleteList.mockResolvedValue({ success: true });
    mockStorage.duplicateList.mockResolvedValue({
      success: true,
      newListId: 'list-c',
    } as any);
  });

  describe('Delete List', () => {
    it('deletes the selected list via the menu and persists index without it', async () => {
      render(<TodoApp />);

      // Initial data load
      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Open the actions menu
      const user = userEvent.setup();
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /list actions/i }));

      // Click Delete list
      const deleteButton = screen.getByTestId('menu-delete-list');
      await user.click(deleteButton);

      // Storage.deleteList should be called with the selected list id ('list-a')
      await waitFor(() => {
        expect(mockStorage.deleteList).toHaveBeenCalledWith('list-a');
      });

      // saveListsIndex should be called with a document that no longer contains 'list-a'
      await waitFor(() => {
        expect(mockStorage.saveListsIndex).toHaveBeenCalled();
      });

      const indexCalls = mockStorage.saveListsIndex.mock.calls;
      // Find the first call whose lists length is 1 (after deletion)
      const postDeleteCall = indexCalls.find(
        ([doc]) => Array.isArray(doc?.lists) && doc.lists.length === 1,
      );
      expect(postDeleteCall).toBeTruthy();
      const postDoc = postDeleteCall?.[0] as any;
      expect(postDoc.lists.map((l: any) => l.id)).toEqual(['list-b']);

      // Title should now reflect the remaining selected list ('Beta')
      await waitFor(() => {
        expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();
      });
    });
  });

  describe('Rename List', () => {
    it('renames the selected list by editing the title and pressing Enter', async () => {
      render(<TodoApp />);

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // Click the title input to enter rename mode
      const user = userEvent.setup();
      const titleInput = await screen.findByTestId('heading');
      await user.click(titleInput);

      // Replace the value and commit with Enter
      await user.clear(titleInput);
      await user.type(titleInput, 'Gamma');
      await user.keyboard('{Enter}');

      // saveListsIndex should be called with updated list name for selected id
      await waitFor(() => {
        expect(mockStorage.saveListsIndex).toHaveBeenCalled();
      });

      const indexCalls = mockStorage.saveListsIndex.mock.calls;
      const renameCall = indexCalls.find(
        ([doc]) =>
          Array.isArray(doc?.lists) &&
          doc.lists.some((l: any) => l.id === 'list-a' && l.name === 'Gamma'),
      );
      expect(renameCall).toBeTruthy();
      const renameDoc = renameCall![0] as {
        lists: Array<{ id: string; updatedAt: string }>;
      };
      const timestamps = renameDoc.lists.map((l) => Date.parse(l.updatedAt));
      expect(renameDoc.lists[0].id).toBe('list-a');
      expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);

      // UI reflects new value
      await waitFor(() => {
        expect(screen.getByDisplayValue('Gamma')).toBeInTheDocument();
      });
    });
  });

  describe('Duplicate List', () => {
    it('duplicates the selected list via the menu and selects the copy', async () => {
      render(<TodoApp />);

      // Initial data load
      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      const user = userEvent.setup();

      // Open the actions menu
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /list actions/i }),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /list actions/i }));

      // Click Duplicate list
      const duplicateButton = screen.getByTestId('menu-duplicate-list');
      await user.click(duplicateButton);

      // Storage.duplicateList should be called with the selected list id ('list-a')
      await waitFor(() => {
        expect(mockStorage.duplicateList).toHaveBeenCalledWith(
          'list-a',
          undefined,
        );
      });

      // UI should reflect the duplicated list selection and name ("Alpha (Copy)")
      await waitFor(() => {
        expect(screen.getByDisplayValue('Alpha (Copy)')).toBeInTheDocument();
      });

      const docWithCopy = mockStorage.saveListsIndex.mock.calls
        .map(([doc]) => doc)
        .find(
          (doc) =>
            Array.isArray(doc?.lists) &&
            doc.lists.length === 3 &&
            doc.lists.some((l: any) => l.id === 'list-c'),
        );
      expect(docWithCopy).toBeTruthy();
      const copyDoc = docWithCopy as {
        lists: Array<{ id: string; updatedAt: string }>;
      };
      expect(copyDoc.lists[0].id).toBe('list-c');
      const copyTimestamps = copyDoc.lists.map((l) => Date.parse(l.updatedAt));
      expect([...copyTimestamps].sort((a, b) => b - a)).toEqual(copyTimestamps);
    });
  });
});
