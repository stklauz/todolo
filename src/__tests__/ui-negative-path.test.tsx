import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import { TodoApp } from '../renderer/features/todos/components/TodoApp';
import TodosProvider from '../renderer/features/todos/contexts/TodosProvider';
import * as storage from '../renderer/features/todos/api/storage';
import { debugLogger } from '../renderer/utils/debug';
import {
  renderAppWithDefaults,
  setupDefaultMocks,
  setupUser,
} from '../tests/utils/ui';

// Mock the storage module
jest.mock('../renderer/features/todos/api/storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

// Local alias remains for compatibility within this file

describe('UI Negative Path – minimal assertions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    debugLogger.disable();
  });

  // Track future UI: visible error indicators for failures
  // See docs/testing-epic/tasks/T6-negative-path-ux-assertions.md for acceptance on error UI
  test.todo('shows a visible error indicator when loading lists fails');
  test.todo('shows a visible error indicator when saving todos fails');

  it('load failure: renders core UI and does not crash (TODO: visible error UI)', async () => {
    // Simulate failing index load — app should seed a new list and persist index
    setupDefaultMocks({
      loadListsIndex: jest
        .fn()
        .mockRejectedValueOnce(new Error('disk unavailable')),
    } as any);

    render(
      <TodosProvider>
        <TodoApp />
      </TodosProvider>,
    );

    // App should recover by creating an initial list (see useTodosState)
    const addListBtn = await screen.findByRole('button', { name: /add list/i });
    expect(addListBtn).toBeInTheDocument();

    // There should be at least one todo input rendered (seeded after load)
    const inputs = await screen.findAllByLabelText('Todo text');
    expect(inputs.length).toBeGreaterThanOrEqual(1);

    // Checkbox for an empty todo must be disabled (interaction rule)
    const checkbox = await screen.findByRole('checkbox', {
      name: /toggle completed/i,
    });
    expect(checkbox).toBeDisabled();

    // Persistence: index should be saved at least once when seeding after failure
    await waitFor(() => expect(mockStorage.saveListsIndex).toHaveBeenCalled());
    expect(mockStorage.saveListsIndex).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2 }),
    );
  });

  // Note: a separate loadListTodos rejection path currently propagates; we will
  // cover it after error UI/logging is implemented for that case.

  it('save failure: logs error without crashing (no visible error UI yet)', async () => {
    // We enable debug to ensure error-logging branches execute and call console.error
    debugLogger.enable();
    try {
      renderAppWithDefaults({
        // Reject on every call to avoid returning undefined after the first call,
        // which would break `.catch` usage in the implementation
        saveListTodos: jest.fn().mockRejectedValue(new Error('write failed')),
      } as any);
      await waitFor(() =>
        expect(mockStorage.loadListsIndex).toHaveBeenCalled(),
      );
      await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

      const user = setupUser();
      const input = screen.getByLabelText('Todo text');
      await user.click(input);
      await user.type(input, 'Buy milk');

      // Debounced save should fire and fail; ensure it surfaces as an error log
      jest.advanceTimersByTime(200);
      await waitFor(() => expect(mockStorage.saveListTodos).toHaveBeenCalled());
      // Args: list id and doc shape
      const call = mockStorage.saveListTodos.mock.calls[0];
      expect(call[0]).toEqual(expect.any(String));
      expect(call[1]).toEqual(
        expect.objectContaining({ version: 2, todos: expect.any(Array) }),
      );

      // With debug enabled, save failure paths log via console.error
      expect(console.error).toHaveBeenCalled();

      // UI remains interactive; Enter should insert a new row below
      await user.keyboard('{Enter}');
      const allInputs = screen.getAllByLabelText('Todo text');
      expect(allInputs.length).toBeGreaterThanOrEqual(2);
    } finally {
      debugLogger.disable();
    }
  });

  it('keyboard: Enter on empty does nothing (no insert, no save, focus unchanged)', async () => {
    renderAppWithDefaults();
    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    const user = setupUser();
    const input = screen.getByLabelText('Todo text');
    await user.click(input);

    // Sanity: empty
    expect((input as HTMLTextAreaElement).value).toBe('');

    await user.keyboard('{Enter}');

    // Still only one input; Enter on empty should be a no-op
    const inputs = screen.getAllByLabelText('Todo text');
    expect(inputs.length).toBe(1);
    // No save attempted for empty text changes
    expect(mockStorage.saveListTodos).not.toHaveBeenCalled();
    // Focus remains on same input
    await waitFor(() => expect(inputs[0]).toHaveFocus());
  });

  it('keyboard: cannot delete the last remaining empty todo (Backspace no-op)', async () => {
    renderAppWithDefaults();
    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    const user = setupUser();
    const input = screen.getByLabelText('Todo text');
    await user.click(input);

    // Backspace on empty when it's the only todo should do nothing
    await user.keyboard('{Backspace}');

    const inputs = screen.getAllByLabelText('Todo text');
    expect(inputs.length).toBe(1);
    // Delete is immediate when it happens; ensure we did not attempt a save
    expect(mockStorage.saveListTodos).not.toHaveBeenCalled();
    // And checkbox remains disabled for the empty todo
    const checkbox = screen.getByRole('checkbox', {
      name: /toggle completed/i,
    });
    expect(checkbox).toBeDisabled();
  });
});
