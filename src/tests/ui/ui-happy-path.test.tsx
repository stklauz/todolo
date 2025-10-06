import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
// user-event is provided via setupUser() from test utils

import * as storage from '../../renderer/features/todos/api/storage';
import {
  renderAppWithDefaults,
  setupDefaultMocks,
  mockStorage,
  setupUser,
} from '../utils/ui';

// Mock the storage module (util relies on the same module reference)
jest.mock('../../renderer/features/todos/api/storage');

describe('UI Happy Path – user interactions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows typing a todo and adding a new line with Enter, saving debounced changes once', async () => {
    renderAppWithDefaults();

    // Wait for initialization
    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    // Core UI present
    expect(
      screen.getByRole('button', { name: /add list/i }),
    ).toBeInTheDocument();
    // Invariant: there is always at least one todo input after load
    expect(screen.getAllByLabelText('Todo text').length).toBeGreaterThanOrEqual(
      1,
    );

    // Interact using user-event with fake timers support
    const user = setupUser();

    const input = screen.getByLabelText('Todo text');
    await user.click(input);
    await user.type(input, 'Buy milk');

    // Debounce window (200ms) should delay the save
    expect(mockStorage.saveListTodos).not.toHaveBeenCalled();
    jest.advanceTimersByTime(199);
    expect(mockStorage.saveListTodos).not.toHaveBeenCalled();

    // Flush the last millisecond to hit debounce
    jest.advanceTimersByTime(1);
    await waitFor(() =>
      expect(mockStorage.saveListTodos).toHaveBeenCalledTimes(1),
    );

    // Press Enter to add the next line (new todo below)
    await user.keyboard('{Enter}');

    // New empty input appears (second row), first row keeps the typed text
    const allInputs = screen.getAllByLabelText('Todo text');
    expect(allInputs.length).toBeGreaterThanOrEqual(2);
    expect((allInputs[0] as HTMLTextAreaElement).value).toBe('Buy milk');
    expect((allInputs[1] as HTMLTextAreaElement).value).toBe('');
    // Focus should move to the newly inserted row (allow effect to run)
    await waitFor(() =>
      expect(screen.getAllByLabelText('Todo text')[1]).toHaveFocus(),
    );

    // Insert operation saves immediately, so total calls should be 2
    await waitFor(() =>
      expect(mockStorage.saveListTodos).toHaveBeenCalledTimes(2),
    );

    // Spec alignment: checkbox disabled for empty todos; enabled for non-empty
    const checkboxes = screen.getAllByRole('checkbox', {
      name: /toggle completed/i,
    });
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    // First row is non-empty -> enabled
    expect(checkboxes[0]).not.toBeDisabled();
    // Second row is empty -> disabled
    expect(checkboxes[1]).toBeDisabled();
  });

  it('debounces across continuous typing and saves once after pause', async () => {
    renderAppWithDefaults();

    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    const user = setupUser();
    const input = screen.getByLabelText('Todo text');
    await user.click(input);
    await user.type(input, 'Buy');
    jest.advanceTimersByTime(150);
    expect(mockStorage.saveListTodos).not.toHaveBeenCalled();
    await user.type(input, ' milk');
    // Still within debounce window since we typed again
    jest.advanceTimersByTime(150);
    expect(mockStorage.saveListTodos).not.toHaveBeenCalled();
    // Finally hit 200ms idle
    jest.advanceTimersByTime(50);
    await waitFor(() =>
      expect(mockStorage.saveListTodos).toHaveBeenCalledTimes(1),
    );
  });

  it('can create a new list, type a todo, and insert with Enter (debounced + immediate saves)', async () => {
    renderAppWithDefaults();

    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    const user = setupUser();

    // Create/select list via sidebar action
    const addListBtn = screen.getByRole('button', { name: /add list/i });
    await user.click(addListBtn);

    // New list is selected and has an input
    const input = await screen.findByLabelText('Todo text');
    await user.click(input);
    await user.type(input, 'Bread');

    // Debounced save after typing
    expect(mockStorage.saveListTodos).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    await waitFor(() =>
      expect(mockStorage.saveListTodos).toHaveBeenCalledTimes(1),
    );

    // Enter inserts new line and saves immediately (second call)
    await user.keyboard('{Enter}');
    const inputs = screen.getAllByLabelText('Todo text');
    expect((inputs[0] as HTMLTextAreaElement).value).toBe('Bread');
    expect((inputs[1] as HTMLTextAreaElement).value).toBe('');
    // Note: after Add list, the app enters rename mode which intentionally
    // prevents todo-focus stealing; skip focus assertion in this flow.
    await waitFor(() =>
      expect(mockStorage.saveListTodos).toHaveBeenCalledTimes(2),
    );
  });
});
