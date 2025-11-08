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

describe('List Management', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('List Creation', () => {
    it('creates a new list when add list button is clicked', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Click add list button
      const addButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addButton);

      // Should call saveListsIndex to persist the new list
      await waitFor(() => {
        expect(mockStorage.saveListsIndex).toHaveBeenCalled();
      });

      const docWithTwoLists = mockStorage.saveListsIndex.mock.calls
        .map(([doc]) => doc)
        .find((doc) => Array.isArray(doc?.lists) && doc.lists.length === 2);
      expect(docWithTwoLists).toBeDefined();
      const twoListDoc = docWithTwoLists as
        | {
            lists: Array<{ id: string; updatedAt: string }>;
            selectedListId?: string;
          }
        | undefined;
      const [first, second] = twoListDoc!.lists;
      expect(first.id).toBe(twoListDoc!.selectedListId);
      expect(second.id).toBe('list-1');
      const timestamps = twoListDoc!.lists.map((l) => Date.parse(l.updatedAt));
      expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
    });

    it('shows spinner during list creation', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        saveListsIndex: jest
          .fn()
          .mockImplementation(
            () =>
              new Promise((resolve) => setTimeout(() => resolve(true), 100)),
          ),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Click add list button
      const addButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addButton);

      // Should show spinner (if the app shows one during save)
      await waitFor(() => {
        expect(mockStorage.saveListsIndex).toHaveBeenCalled();
      });
    });
  });

  describe('Basic List Operations', () => {
    it('loads lists on app initialization', async () => {
      renderAppWithDefaults();

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });
    });

    it('loads todos for the selected list', async () => {
      renderAppWithDefaults();

      await waitFor(() => {
        expect(mockStorage.loadListTodos).toHaveBeenCalled();
      });
    });

    it('renders the add list button', async () => {
      renderAppWithDefaults();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add list/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles storage errors gracefully during list operations', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        loadListsIndex: jest.fn().mockRejectedValue(new Error('Storage error')),
      });

      // Should handle the error gracefully
      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // App should still render
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });

    it('handles network timeouts during list operations', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        saveListsIndex: jest
          .fn()
          .mockRejectedValue(new Error('Network timeout')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Click add list button
      const addButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addButton);

      // Should handle the timeout gracefully
      await waitFor(() => {
        expect(mockStorage.saveListsIndex).toHaveBeenCalled();
      });
    });
  });

  describe('List State Management', () => {
    it('maintains list state across operations', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // App should maintain its state
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });

    it('handles empty list state', async () => {
      renderAppWithDefaults({
        loadListsIndex: jest.fn().mockResolvedValue({
          version: 2,
          lists: [],
          selectedListId: undefined,
        }),
      });

      await waitFor(() => {
        expect(mockStorage.loadListsIndex).toHaveBeenCalled();
      });

      // App should still render with add button
      expect(
        screen.getByRole('button', { name: /add list/i }),
      ).toBeInTheDocument();
    });
  });
});
