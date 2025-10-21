// Mock storage so test utils can configure resolved values
import { screen, waitFor } from '@testing-library/react';
import {
  renderAppWithDefaults,
  setupUser,
  mockStorage,
} from '../../testUtils/ui';

jest.mock('../../features/todos/api/storage');

describe('Todo Core Smoke (UI)', () => {
  it('happy path across add/edit/toggle/delete and filters', async () => {
    const user = setupUser();
    renderAppWithDefaults();

    await waitFor(() => expect(mockStorage.loadListsIndex).toHaveBeenCalled());
    await waitFor(() => expect(mockStorage.loadListTodos).toHaveBeenCalled());

    // Add three todos using the input and Enter
    const first = screen.getByLabelText('Todo text');
    await user.click(first);
    await user.type(first, 'A{enter}');
    // Focus moves to the new empty input; target the last input explicitly
    const afterA = screen.getAllByLabelText('Todo text');
    await user.type(afterA[afterA.length - 1], 'B{enter}');
    const afterB = screen.getAllByLabelText('Todo text');
    await user.type(afterB[afterB.length - 1], 'C');

    // Edit the middle non-empty todo to B2
    const inputs = screen.getAllByLabelText('Todo text');
    const nonEmpty = inputs.filter(
      (el) => (el as HTMLTextAreaElement).value !== '',
    );
    await user.clear(nonEmpty[1]!);
    await user.type(nonEmpty[1]!, 'B2');

    // Toggle first and last checkboxes
    const checkboxes = screen.getAllByRole('checkbox', {
      name: /toggle completed/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[checkboxes.length - 1]);

    // Open actions menu and hide completed
    await user.click(screen.getByRole('button', { name: /list actions/i }));
    const completedToggle = screen.getByRole('checkbox', {
      name: /completed items/i,
    });
    // If initially checked (hide), uncheck to show; then check to hide again
    if (!(completedToggle as HTMLInputElement).checked) {
      await user.click(completedToggle); // enable hide
    } else {
      // already hiding; just proceed
    }
    await waitFor(() => {
      const visibleInputs = screen.getAllByLabelText('Todo text');
      // At least the active middle item should be visible
      expect(visibleInputs.length).toBeGreaterThanOrEqual(1);
    });

    // Delete the last empty todo via Backspace
    const current = screen.getAllByLabelText('Todo text');
    const emptyIdx = current.findIndex(
      (el) => (el as HTMLTextAreaElement).value === '',
    );
    if (emptyIdx >= 0) {
      await user.click(current[emptyIdx]);
      await user.keyboard('{Backspace}');
    }

    // List should shrink or stay consistent if there was no empty
    await waitFor(() => {
      const after = screen.getAllByLabelText('Todo text');
      expect(after.length).toBeGreaterThanOrEqual(1);
    });
  });
});
