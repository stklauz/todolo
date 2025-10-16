import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TodoApp } from '../renderer/features/todos/components/TodoApp';
import * as storage from '../renderer/features/todos/api/storage';

// Mock the storage module to observe calls from UI to storage and assert IPC wiring
jest.mock('../renderer/features/todos/api/storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Delete List - UI to DB wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.loadAppSettings.mockResolvedValue({ hideCompletedItems: true });
    mockStorage.loadListsIndex.mockResolvedValue({
      version: 2,
      lists: [
        { id: 'list-a', name: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'list-b', name: 'Beta', createdAt: '2024-01-02T00:00:00.000Z' },
      ],
      selectedListId: 'list-a',
    });
    mockStorage.loadListTodos.mockResolvedValue({ version: 2, todos: [] });
    mockStorage.saveListsIndex.mockResolvedValue(true);
    mockStorage.saveListTodos.mockResolvedValue(true);
    mockStorage.deleteList.mockResolvedValue({ success: true });
  });

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
      expect(screen.getByRole('heading', { name: 'Beta' })).toBeInTheDocument();
    });
  });
});
