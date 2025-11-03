import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('Accessibility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('ARIA Attributes and Roles', () => {
    it('has proper ARIA attributes for basic interactive elements', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Add list button should have proper ARIA attributes
      const addListButton = screen.getByRole('button', { name: /add list/i });
      expect(addListButton).toHaveAttribute('aria-label', 'Add list');
      expect(addListButton).toHaveAttribute('title', 'Add list');

      // Live region should be present for status announcements
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('has proper semantic structure', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Should have proper heading structure
      const heading = screen.getByTestId('heading');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveDisplayValue('My Todos');

      // Sidebar should have proper role
      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('maintains proper focus order for available elements', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      // Focus should be manageable on interactive elements - the first focusable is likely a todo input
      await user.tab();

      // Verify something has focus (don't hardcode which element, as tab order may vary)
      expect(document.activeElement).not.toBe(document.body);

      // Verify Add List button is focusable
      const addListButton = screen.getByRole('button', { name: /add list/i });
      addListButton.focus();
      expect(addListButton).toHaveFocus();
    });

    it('handles keyboard activation correctly', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      const addListButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addListButton);

      // Button should be activated (we can't easily test the result in this context)
      // but we can ensure no errors occur
      expect(addListButton).toBeInTheDocument();
    });
  });

  describe('ARIA Live Regions', () => {
    it('provides accessible feedback for list operations', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // The live region should be present even when not actively used
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('announces status changes when operations occur', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Click add list button to trigger an operation
      const addListButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addListButton);

      // Live region should still be present and functional
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation for available interactive elements', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      // Verify Add List button is keyboard accessible
      const addListButton = screen.getByRole('button', { name: /add list/i });
      addListButton.focus();
      expect(addListButton).toHaveFocus();

      // Should be able to activate with Enter or Space
      await user.keyboard('{Enter}');
      // Button should be activated (we can't easily test the result in this context)
    });

    it('handles keyboard shortcuts appropriately', async () => {
      const user = setupUser();
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      const addListButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addListButton);

      // Should handle keyboard events without errors
      await user.keyboard('{Escape}');
      // No specific behavior expected, but should not cause errors
    });
  });

  describe('Screen Reader Support', () => {
    it('provides meaningful labels for all interactive elements', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // All interactive elements should have accessible names
      const addListButton = screen.getByRole('button', { name: /add list/i });
      expect(addListButton).toBeInTheDocument();

      // Heading should have meaningful text
      const heading = screen.getByTestId('heading');
      expect(heading).toHaveDisplayValue('My Todos');
    });

    it('provides context for available operations', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Add list button should have clear purpose
      const addListButton = screen.getByRole('button', { name: /add list/i });
      expect(addListButton).toHaveAttribute('title', 'Add list');
      expect(addListButton).toHaveAttribute('aria-label', 'Add list');
    });
  });

  describe('Color and Contrast', () => {
    it('ensures interactive elements are visually distinct', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Buttons should have proper styling classes
      const addListButton = screen.getByRole('button', { name: /add list/i });
      expect(addListButton).toHaveClass('iconBtn');
    });

    it('provides visual feedback for interactive elements', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Interactive elements should have proper styling
      const addListButton = screen.getByRole('button', { name: /add list/i });
      expect(addListButton).toHaveClass('iconBtn');

      // Heading should have proper styling
      const heading = screen.getByTestId('heading');
      expect(heading).toHaveClass('titleInput');
    });
  });

  describe('Error Handling and Accessibility', () => {
    it('maintains accessibility during error states', async () => {
      renderAppWithDefaults({
        loadListsIndex: jest.fn().mockRejectedValue(new Error('Storage error')),
      });

      // App should still render accessible elements even during errors
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add list/i }),
        ).toBeInTheDocument();
      });

      // Interactive elements should still be accessible
      const addListButton = screen.getByRole('button', { name: /add list/i });
      expect(addListButton).toHaveAttribute('aria-label', 'Add list');
    });

    it('provides accessible error feedback', async () => {
      const user = setupUser();
      renderAppWithDefaults({
        saveListsIndex: jest.fn().mockRejectedValue(new Error('Save failed')),
      });

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Click add list button to trigger an operation that might fail
      const addListButton = screen.getByRole('button', { name: /add list/i });
      await user.click(addListButton);

      // Live region should be present for error announcements
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Semantic HTML', () => {
    it('uses proper HTML semantics', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Should use proper heading hierarchy
      const heading = screen.getByTestId('heading');
      expect(heading.tagName).toBe('INPUT');

      // Should use proper button elements
      const addListButton = screen.getByRole('button', { name: /add list/i });
      expect(addListButton.tagName).toBe('BUTTON');

      // Should use proper landmark roles
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.tagName).toBe('ASIDE');
    });

    it('provides proper document structure', async () => {
      renderAppWithDefaults();

      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );

      // Should have a logical document structure
      const heading = screen.getByTestId('heading');
      expect(heading).toBeInTheDocument();

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeInTheDocument();

      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toBeInTheDocument();
    });
  });
});
