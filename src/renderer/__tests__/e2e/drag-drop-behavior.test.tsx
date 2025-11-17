import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderAppWithDefaults } from '../../testUtils/ui';

jest.mock('../../features/todos/api/storage');

describe('Drag & Drop behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('dragging a level-0 over a level-1 inserts between level-1 siblings (no snap to parent)', async () => {
    // Initial order: A(0), B(1), C(1), X(0)
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'A', completed: false, indent: 0 },
          { id: 2, text: 'B', completed: false, indent: 1 },
          { id: 3, text: 'C', completed: false, indent: 1 },
          { id: 4, text: 'X', completed: false, indent: 0 },
        ],
      }),
    });

    await waitFor(() =>
      expect(screen.getAllByLabelText('Todo text').length).toBe(4),
    );

    const inputs = screen.getAllByLabelText('Todo text');
    expect(inputs.map((i) => (i as HTMLTextAreaElement).value)).toEqual([
      'A',
      'B',
      'C',
      'X',
    ]);

    // Get drag handles (span role="button" aria-label="Drag to reorder")
    const handles = screen.getAllByTestId('todo-indent');

    // Source: X (index 3). Target: C (index 2)
    const sourceHandle = handles[3];
    const targetRow = (inputs[2] as HTMLElement).closest('div');
    if (!targetRow) throw new Error('Target row not found');

    fireEvent.dragStart(sourceHandle);
    fireEvent.dragOver(targetRow);
    fireEvent.drop(targetRow);
    fireEvent.dragEnd(sourceHandle);

    // Expect X inserted between B and C: A, B, X, C
    const after = screen.getAllByLabelText('Todo text');
    expect(after.map((i) => (i as HTMLTextAreaElement).value)).toEqual([
      'A',
      'B',
      'X',
      'C',
    ]);
  });

  test('dragging a level-1 over sibling level-1 stays within the group (does not jump above parent)', async () => {
    // Initial order: 1(0), 2(1), 3(1)
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: '1', completed: false, indent: 0 },
          { id: 2, text: '2', completed: false, indent: 1 },
          { id: 3, text: '3', completed: false, indent: 1 },
        ],
      }),
    });

    await waitFor(() =>
      expect(screen.getAllByLabelText('Todo text').length).toBe(3),
    );

    const inputs = screen.getAllByLabelText('Todo text');
    expect(inputs.map((i) => (i as HTMLTextAreaElement).value)).toEqual([
      '1',
      '2',
      '3',
    ]);

    const handles = screen.getAllByTestId('todo-indent');

    // Drag item '3' over item '2'
    const sourceHandle = handles[2];
    const targetRow = (inputs[1] as HTMLElement).closest('div');
    if (!targetRow) throw new Error('Target row not found');

    fireEvent.dragStart(sourceHandle);
    fireEvent.dragOver(targetRow);
    fireEvent.drop(targetRow);
    fireEvent.dragEnd(sourceHandle);

    const after = screen.getAllByLabelText('Todo text');
    // Parent '1' should remain first; '3' should be adjacent to '2' within the group
    expect((after[0] as HTMLTextAreaElement).value).toBe('1');
    expect(after.map((i) => (i as HTMLTextAreaElement).value)).toEqual([
      '1',
      '3',
      '2',
    ]);
  });

  test('dragging parent with children moves entire block', async () => {
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'Parent A', completed: false, indent: 0 },
          { id: 2, text: 'Child A1', completed: false, indent: 1 },
          { id: 3, text: 'Child A2', completed: false, indent: 1 },
          { id: 4, text: 'Parent B', completed: false, indent: 0 },
        ],
      }),
    });

    await waitFor(() =>
      expect(screen.getAllByLabelText('Todo text').length).toBe(4),
    );

    const inputs = screen.getAllByLabelText('Todo text');
    const handles = screen.getAllByTestId('todo-indent');

    // Drag Parent A (with children) over Parent B
    const sourceHandle = handles[0];
    const targetRow = (inputs[3] as HTMLElement).closest('div');
    if (!targetRow) throw new Error('Target row not found');

    fireEvent.dragStart(sourceHandle);
    fireEvent.dragOver(targetRow);
    fireEvent.drop(targetRow);
    fireEvent.dragEnd(sourceHandle);

    const after = screen.getAllByLabelText('Todo text');
    // Entire block (Parent A + children) should move together and be inserted at Parent B's position
    expect(after.map((i) => (i as HTMLTextAreaElement).value)).toEqual([
      'Parent A',
      'Child A1',
      'Child A2',
      'Parent B',
    ]);
  });

  test('basic reorder of same-level parents', async () => {
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'First', completed: false, indent: 0 },
          { id: 2, text: 'Second', completed: false, indent: 0 },
          { id: 3, text: 'Third', completed: false, indent: 0 },
        ],
      }),
    });

    await waitFor(() =>
      expect(screen.getAllByLabelText('Todo text').length).toBe(3),
    );

    const inputs = screen.getAllByLabelText('Todo text');
    const handles = screen.getAllByTestId('todo-indent');

    // Drag Third over First
    const sourceHandle = handles[2];
    const targetRow = (inputs[0] as HTMLElement).closest('div');
    if (!targetRow) throw new Error('Target row not found');

    fireEvent.dragStart(sourceHandle);
    fireEvent.dragOver(targetRow);
    fireEvent.drop(targetRow);
    fireEvent.dragEnd(sourceHandle);

    const after = screen.getAllByLabelText('Todo text');
    expect(after.map((i) => (i as HTMLTextAreaElement).value)).toEqual([
      'Third',
      'First',
      'Second',
    ]);
  });

  test('renders indentation classes for deep hierarchies', async () => {
    renderAppWithDefaults({
      loadListTodos: jest.fn().mockResolvedValue({
        version: 2,
        todos: [
          { id: 1, text: 'Root', completed: false, indent: 0 },
          { id: 2, text: 'Child', completed: false, indent: 1 },
          { id: 3, text: 'Grandchild', completed: false, indent: 2 },
          { id: 4, text: 'Great grandchild', completed: false, indent: 3 },
        ],
      }),
    });

    await waitFor(() =>
      expect(screen.getAllByTestId('todo-indent').length).toBe(4),
    );

    const handles = screen.getAllByTestId('todo-indent');
    expect(handles[1].className).toContain('indent1');
    expect(handles[2].className).toContain('indent2');
    expect(handles[3].className).toContain('indent3');
  });
});
