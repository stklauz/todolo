import React from 'react';
import { renderHook } from '@testing-library/react';
import useTodoKeyboardHandlers from '../useTodoKeyboardHandlers';
import type { EditorTodo } from '../../types';

describe('useTodoKeyboardHandlers', () => {
  const mockTodos: EditorTodo[] = [
    { id: 1, text: 'Parent 1', completed: false, indent: 0, parentId: null },
    { id: 2, text: 'Child 1.1', completed: false, indent: 1, parentId: 1 },
    { id: 3, text: 'Child 1.2', completed: false, indent: 1, parentId: 1 },
    { id: 4, text: 'Parent 2', completed: false, indent: 0, parentId: null },
    { id: 5, text: '', completed: false, indent: 0, parentId: null },
  ];

  const mockChangeIndent = jest.fn();
  const mockInsertTodoBelow = jest.fn();
  const mockRemoveTodoAt = jest.fn();
  const mockUpdateTodo = jest.fn();
  const mockFocusTodo = jest.fn();

  const defaultProps = {
    allTodos: mockTodos,
    changeIndent: mockChangeIndent,
    insertTodoBelow: mockInsertTodoBelow,
    removeTodoAt: mockRemoveTodoAt,
    updateTodo: mockUpdateTodo,
    focusTodo: mockFocusTodo,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInsertTodoBelow.mockReturnValue(999); // Mock new todo ID
  });

  describe('Hook initialization', () => {
    it('should return a function that creates keyboard handlers', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      expect(typeof result.current).toBe('function');

      const handler = result.current(1);
      expect(typeof handler).toBe('function');
    });

    it('should handle invalid todo ID gracefully', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(999); // Non-existent ID
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      // Should not call any actions for invalid ID
      expect(mockChangeIndent).not.toHaveBeenCalled();
      expect(mockInsertTodoBelow).not.toHaveBeenCalled();
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });
  });

  describe('Tab key handling', () => {
    it('should outdent when Shift+Tab is pressed', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(2); // Child todo
      const mockEvent = {
        key: 'Tab',
        shiftKey: true,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).toHaveBeenCalledWith(2, -1);
    });

    it('should indent when Tab is pressed and a valid ancestor exists above', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(3); // Second child todo
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).toHaveBeenCalledWith(3, +1);
    });

    it('should not indent when Tab is pressed and no parent exists above', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1); // Parent todo (no parent above)
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).not.toHaveBeenCalled();
    });

    it('should handle Tab on first todo in list', () => {
      const singleTodo = [mockTodos[0]];
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({ ...defaultProps, allTodos: singleTodo }),
      );

      const handler = result.current(1);
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).not.toHaveBeenCalled();
    });

    it('should not indent when already at maximum supported depth', () => {
      const deepTodos: EditorTodo[] = [
        { id: 1, text: 'Root', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: false, indent: 1, parentId: 1 },
        { id: 3, text: 'Grandchild', completed: false, indent: 2, parentId: 2 },
        {
          id: 4,
          text: 'Great grandchild',
          completed: false,
          indent: 3,
          parentId: 3,
        },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({ ...defaultProps, allTodos: deepTodos }),
      );

      const handler = result.current(4);
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).not.toHaveBeenCalled();
    });
  });

  describe('Enter key handling', () => {
    it('should create new empty todo when Enter is pressed at end of text', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1); // Parent todo with text "Parent 1"
      const textarea = document.createElement('textarea');
      textarea.value = 'Parent 1';
      textarea.setSelectionRange(8, 8); // Cursor at end

      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).not.toHaveBeenCalled(); // No update needed for end
      expect(mockInsertTodoBelow).toHaveBeenCalledWith(0, ''); // Index of todo with id 1
      expect(mockFocusTodo).toHaveBeenCalledWith(999, 'start'); // Focus new todo at start
    });

    it('should split content when Enter is pressed in middle of text', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1); // Parent todo with text "Parent 1"
      const textarea = document.createElement('textarea');
      textarea.value = 'Parent 1';
      textarea.setSelectionRange(4, 4); // Cursor after "Pare"

      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).toHaveBeenCalledWith(1, 'Pare'); // Left part
      expect(mockInsertTodoBelow).toHaveBeenCalledWith(0, 'nt 1'); // Right part
      expect(mockFocusTodo).toHaveBeenCalledWith(999, 'start'); // Focus new todo at start
    });

    it('should move content to new todo when Enter is pressed at start of text', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1); // Parent todo with text "Parent 1"
      const textarea = document.createElement('textarea');
      textarea.value = 'Parent 1';
      textarea.setSelectionRange(0, 0); // Cursor at start

      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).toHaveBeenCalledWith(1, ''); // Current todo becomes empty
      expect(mockInsertTodoBelow).toHaveBeenCalledWith(0, 'Parent 1'); // Content moves to new todo
      expect(mockFocusTodo).toHaveBeenCalledWith(999, 'start'); // Focus new todo at start
    });

    it('should not create new todo when Enter is pressed on empty todo', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(5); // Empty todo
      const textarea = document.createElement('textarea');
      textarea.value = '';
      textarea.setSelectionRange(0, 0);

      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).not.toHaveBeenCalled();
      expect(mockInsertTodoBelow).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });

    it('should not create new todo when Enter is pressed on whitespace-only todo', () => {
      const todosWithWhitespace = [
        ...mockTodos.slice(0, 4),
        { id: 5, text: '   ', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosWithWhitespace,
        }),
      );

      const handler = result.current(5);
      const textarea = document.createElement('textarea');
      textarea.value = '   ';
      textarea.setSelectionRange(3, 3);

      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).not.toHaveBeenCalled();
      expect(mockInsertTodoBelow).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });

    it('should handle emojis correctly when splitting', () => {
      const todosWithEmoji: EditorTodo[] = [
        { id: 1, text: 'Hello 👋 world', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosWithEmoji,
        }),
      );

      const handler = result.current(1);
      const textarea = document.createElement('textarea');
      textarea.value = 'Hello 👋 world';
      textarea.setSelectionRange(6, 6); // After "Hello " (emoji is at position 6-8)

      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).toHaveBeenCalledWith(1, 'Hello '); // Left part
      expect(mockInsertTodoBelow).toHaveBeenCalledWith(0, '👋 world'); // Right part with emoji
      expect(mockFocusTodo).toHaveBeenCalledWith(999, 'start');
    });

    it('should preserve whitespace when splitting', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1);
      const textarea = document.createElement('textarea');
      textarea.value = 'Hello   world';
      textarea.setSelectionRange(7, 7); // In middle of spaces

      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).toHaveBeenCalledWith(1, 'Hello  '); // Preserves left whitespace
      expect(mockInsertTodoBelow).toHaveBeenCalledWith(0, ' world'); // Preserves right whitespace
      expect(mockFocusTodo).toHaveBeenCalledWith(999, 'start');
    });
  });

  describe('Backspace key handling', () => {
    it('should outdent when Backspace is pressed on empty indented todo', () => {
      const todosWithIndentedEmpty = [
        ...mockTodos.slice(0, 4),
        { id: 5, text: '', completed: false, indent: 1 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosWithIndentedEmpty,
        }),
      );

      const handler = result.current(5);
      const textarea = document.createElement('textarea');
      textarea.value = '';
      textarea.setSelectionRange(0, 0);

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).toHaveBeenCalledWith(5, -1);
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
    });

    it('should delete todo when Backspace is pressed on empty non-indented todo', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(5); // Empty todo with indent 0
      const textarea = document.createElement('textarea');
      textarea.value = '';
      textarea.setSelectionRange(0, 0);

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockRemoveTodoAt).toHaveBeenCalledWith(4); // Index of todo with id 5
      expect(mockFocusTodo).toHaveBeenCalledWith(4); // Previous todo
    });

    it('should not delete the last remaining todo', () => {
      const singleEmptyTodo = [
        { id: 1, text: '', completed: false, indent: 0 },
      ];
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({ ...defaultProps, allTodos: singleEmptyTodo }),
      );

      const handler = result.current(1);
      const textarea = document.createElement('textarea');
      textarea.value = '';
      textarea.setSelectionRange(0, 0);

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });

    it('should focus previous todo after deletion', () => {
      const todosWithEmptyParent2 = [
        { id: 1, text: 'Parent 1', completed: false, indent: 0 },
        { id: 2, text: 'Child 1.1', completed: false, indent: 1 },
        { id: 3, text: 'Child 1.2', completed: false, indent: 1 },
        { id: 4, text: '', completed: false, indent: 0 }, // Empty Parent 2
      ];
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosWithEmptyParent2,
        }),
      );

      const handler = result.current(4); // Empty Parent 2 (index 3)
      const textarea = document.createElement('textarea');
      textarea.value = '';
      textarea.setSelectionRange(0, 0);

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockRemoveTodoAt).toHaveBeenCalledWith(3);
      expect(mockFocusTodo).toHaveBeenCalledWith(3); // Previous todo (Child 1.2)
    });

    it('should not prevent default when Backspace is pressed on non-empty todo with cursor in middle', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1); // Non-empty todo
      const textarea = document.createElement('textarea');
      textarea.value = 'Parent 1';
      textarea.setSelectionRange(3, 3); // Cursor in middle

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      // Should not intercept when cursor is not at start (normal text editing)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockChangeIndent).not.toHaveBeenCalled();
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });

    it('should merge with previous todo when Backspace is pressed at start of non-empty todo', () => {
      const todosForMerge: EditorTodo[] = [
        { id: 1, text: 'Hello', completed: false, indent: 0 },
        { id: 2, text: 'world', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosForMerge,
        }),
      );

      const handler = result.current(2); // Second todo
      const textarea = document.createElement('textarea');
      textarea.value = 'world';
      textarea.setSelectionRange(0, 0); // Cursor at start

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).toHaveBeenCalledWith(1, 'Helloworld'); // Merged content
      expect(mockRemoveTodoAt).toHaveBeenCalledWith(1); // Remove current todo
      expect(mockFocusTodo).toHaveBeenCalledWith(1, 5); // Focus previous at junction (length of "Hello")
    });

    it('should not merge when Backspace is pressed at start of first todo', () => {
      const singleTodo: EditorTodo[] = [
        { id: 1, text: 'Only todo', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: singleTodo,
        }),
      );

      const handler = result.current(1);
      const textarea = document.createElement('textarea');
      textarea.value = 'Only todo';
      textarea.setSelectionRange(0, 0); // Cursor at start

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      // Should not intercept (no previous todo to merge with)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockUpdateTodo).not.toHaveBeenCalled();
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
    });

    it('should preserve whitespace when merging', () => {
      const todosWithSpaces: EditorTodo[] = [
        { id: 1, text: 'Hello ', completed: false, indent: 0 },
        { id: 2, text: ' world', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosWithSpaces,
        }),
      );

      const handler = result.current(2);
      const textarea = document.createElement('textarea');
      textarea.value = ' world';
      textarea.setSelectionRange(0, 0); // Cursor at start

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).toHaveBeenCalledWith(1, 'Hello  world'); // Preserves whitespace
      expect(mockRemoveTodoAt).toHaveBeenCalledWith(1);
      expect(mockFocusTodo).toHaveBeenCalledWith(1, 6); // Focus at junction (length of "Hello ")
    });

    it('should handle emojis correctly when merging', () => {
      const todosWithEmoji: EditorTodo[] = [
        { id: 1, text: 'Hello ', completed: false, indent: 0 },
        { id: 2, text: '👋 world', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosWithEmoji,
        }),
      );

      const handler = result.current(2);
      const textarea = document.createElement('textarea');
      textarea.value = '👋 world';
      textarea.setSelectionRange(0, 0); // Cursor at start

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateTodo).toHaveBeenCalledWith(1, 'Hello 👋 world'); // Merged with emoji
      expect(mockRemoveTodoAt).toHaveBeenCalledWith(1);
      expect(mockFocusTodo).toHaveBeenCalledWith(1, 6); // Focus at junction (length of "Hello ")
    });

    it('should merge with correct previous todo when there are multiple todos', () => {
      const multipleTodos: EditorTodo[] = [
        { id: 1, text: 'First', completed: false, indent: 0 },
        { id: 2, text: 'Second', completed: false, indent: 0 },
        { id: 3, text: 'Third', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: multipleTodos,
        }),
      );

      const handler = result.current(3); // Third todo
      const textarea = document.createElement('textarea');
      textarea.value = 'Third';
      textarea.setSelectionRange(0, 0); // Cursor at start

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      // Should merge with second todo (index 1), not first
      expect(mockUpdateTodo).toHaveBeenCalledWith(2, 'SecondThird');
      expect(mockRemoveTodoAt).toHaveBeenCalledWith(2); // Index of third todo
      expect(mockFocusTodo).toHaveBeenCalledWith(2, 6); // Focus at junction (length of "Second")
    });

    it('should not intercept when text is selected', () => {
      const todosForSelection: EditorTodo[] = [
        { id: 1, text: 'Hello', completed: false, indent: 0 },
        { id: 2, text: 'world', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosForSelection,
        }),
      );

      const handler = result.current(2);
      const textarea = document.createElement('textarea');
      textarea.value = 'world';
      textarea.setSelectionRange(0, 3); // Selected "wor" (has selection)

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      // Should not intercept when text is selected (let browser handle deletion)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockUpdateTodo).not.toHaveBeenCalled();
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
    });

    it('should not intercept when text is selected even if selection starts at 0', () => {
      const todosForSelection: EditorTodo[] = [
        { id: 1, text: 'Hello', completed: false, indent: 0 },
        { id: 2, text: 'world', completed: false, indent: 0 },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosForSelection,
        }),
      );

      const handler = result.current(2);
      const textarea = document.createElement('textarea');
      textarea.value = 'world';
      textarea.setSelectionRange(0, 2); // Selected "wo" starting at 0 (has selection)

      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
        currentTarget: textarea,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      // Should not intercept even though selection starts at 0 (has selection)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockUpdateTodo).not.toHaveBeenCalled();
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
    });

    describe('hideCompletedItems behavior', () => {
      it('should merge with completed todo in active section when hideCompletedItems is false', () => {
        // Completed todo with active parent (in active section)
        const todosWithCompletedInActive: EditorTodo[] = [
          {
            id: 1,
            text: 'Parent',
            completed: false,
            indent: 0,
            parentId: null,
          },
          {
            id: 2,
            text: 'Completed child',
            completed: true,
            indent: 0,
            parentId: 1,
          },
          {
            id: 3,
            text: 'Active',
            completed: false,
            indent: 0,
            parentId: null,
          },
        ];

        const { result } = renderHook(() =>
          useTodoKeyboardHandlers({
            ...defaultProps,
            allTodos: todosWithCompletedInActive,
            hideCompletedItems: false,
          }),
        );

        const handler = result.current(3);
        const textarea = document.createElement('textarea');
        textarea.value = 'Active';
        textarea.setSelectionRange(0, 0); // Cursor at start

        const mockEvent = {
          key: 'Backspace',
          preventDefault: jest.fn(),
          currentTarget: textarea,
        } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

        handler(mockEvent);

        // Should merge with completed child (in active section because parent is active)
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockUpdateTodo).toHaveBeenCalledWith(2, 'Completed childActive');
        expect(mockRemoveTodoAt).toHaveBeenCalledWith(2);
        expect(mockFocusTodo).toHaveBeenCalledWith(2, 15); // Focus at junction (length of "Completed child")
      });

      it('should skip completed todo in completed section when current is active and hideCompletedItems is false', () => {
        // Completed parent with completed child (both in completed section)
        const todosWithCompletedSection: EditorTodo[] = [
          { id: 1, text: 'Parent', completed: true, indent: 0, parentId: null },
          {
            id: 2,
            text: 'Completed child',
            completed: true,
            indent: 0,
            parentId: 1,
          },
          {
            id: 3,
            text: 'Active',
            completed: false,
            indent: 0,
            parentId: null,
          },
        ];

        const { result } = renderHook(() =>
          useTodoKeyboardHandlers({
            ...defaultProps,
            allTodos: todosWithCompletedSection,
            hideCompletedItems: false,
          }),
        );

        const handler = result.current(3);
        const textarea = document.createElement('textarea');
        textarea.value = 'Active';
        textarea.setSelectionRange(0, 0); // Cursor at start

        const mockEvent = {
          key: 'Backspace',
          preventDefault: jest.fn(),
          currentTarget: textarea,
        } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

        handler(mockEvent);

        // Should skip completed child (in completed section) and merge with parent
        // But parent is also in completed section, so should skip both
        // Actually, wait - if both are in completed section and we skip them, there's no merge target
        // So it should not merge at all
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(mockUpdateTodo).not.toHaveBeenCalled();
        expect(mockRemoveTodoAt).not.toHaveBeenCalled();
      });

      it('should merge with completed todo in completed section when current is also completed', () => {
        // Both todos are completed (in completed section)
        const todosBothCompleted: EditorTodo[] = [
          {
            id: 1,
            text: 'Completed 1',
            completed: true,
            indent: 0,
            parentId: null,
          },
          {
            id: 2,
            text: 'Completed 2',
            completed: true,
            indent: 0,
            parentId: null,
          },
        ];

        const { result } = renderHook(() =>
          useTodoKeyboardHandlers({
            ...defaultProps,
            allTodos: todosBothCompleted,
            hideCompletedItems: false,
          }),
        );

        const handler = result.current(2);
        const textarea = document.createElement('textarea');
        textarea.value = 'Completed 2';
        textarea.setSelectionRange(0, 0); // Cursor at start

        const mockEvent = {
          key: 'Backspace',
          preventDefault: jest.fn(),
          currentTarget: textarea,
        } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

        handler(mockEvent);

        // Should merge with previous completed todo (both in completed section, so allowed)
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockUpdateTodo).toHaveBeenCalledWith(
          1,
          'Completed 1Completed 2',
        );
        expect(mockRemoveTodoAt).toHaveBeenCalledWith(1);
        expect(mockFocusTodo).toHaveBeenCalledWith(1, 11); // Focus at junction (length of "Completed 1")
      });

      it('should skip completed todo when hideCompletedItems is true', () => {
        const todosWithCompleted: EditorTodo[] = [
          {
            id: 1,
            text: 'Parent',
            completed: false,
            indent: 0,
            parentId: null,
          },
          {
            id: 2,
            text: 'Completed child',
            completed: true,
            indent: 0,
            parentId: 1,
          },
          {
            id: 3,
            text: 'Active child',
            completed: false,
            indent: 0,
            parentId: 1,
          },
        ];

        const { result } = renderHook(() =>
          useTodoKeyboardHandlers({
            ...defaultProps,
            allTodos: todosWithCompleted,
            hideCompletedItems: true,
          }),
        );

        const handler = result.current(3);
        const textarea = document.createElement('textarea');
        textarea.value = 'Active child';
        textarea.setSelectionRange(0, 0); // Cursor at start

        const mockEvent = {
          key: 'Backspace',
          preventDefault: jest.fn(),
          currentTarget: textarea,
        } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

        handler(mockEvent);

        // Should skip completed todo and merge with parent
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockUpdateTodo).toHaveBeenCalledWith(1, 'ParentActive child');
        expect(mockRemoveTodoAt).toHaveBeenCalledWith(2); // Index of todo with id 3
        expect(mockFocusTodo).toHaveBeenCalledWith(1, 6); // Focus at junction (length of "Parent")
      });

      it('should merge with previous non-completed sibling when hideCompletedItems is true', () => {
        const todosWithSiblings: EditorTodo[] = [
          {
            id: 1,
            text: 'Parent',
            completed: false,
            indent: 0,
            parentId: null,
          },
          {
            id: 2,
            text: 'Sibling 1',
            completed: false,
            indent: 0,
            parentId: 1,
          },
          {
            id: 3,
            text: 'Completed sibling',
            completed: true,
            indent: 0,
            parentId: 1,
          },
          {
            id: 4,
            text: 'Sibling 2',
            completed: false,
            indent: 0,
            parentId: 1,
          },
        ];

        const { result } = renderHook(() =>
          useTodoKeyboardHandlers({
            ...defaultProps,
            allTodos: todosWithSiblings,
            hideCompletedItems: true,
          }),
        );

        const handler = result.current(4);
        const textarea = document.createElement('textarea');
        textarea.value = 'Sibling 2';
        textarea.setSelectionRange(0, 0); // Cursor at start

        const mockEvent = {
          key: 'Backspace',
          preventDefault: jest.fn(),
          currentTarget: textarea,
        } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

        handler(mockEvent);

        // Should skip completed sibling and merge with previous non-completed sibling
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockUpdateTodo).toHaveBeenCalledWith(2, 'Sibling 1Sibling 2');
        expect(mockRemoveTodoAt).toHaveBeenCalledWith(3); // Index of todo with id 4
        expect(mockFocusTodo).toHaveBeenCalledWith(2, 9); // Focus at junction (length of "Sibling 1" = 9)
      });

      it('should not merge when all previous items are completed and hidden', () => {
        const allCompleted: EditorTodo[] = [
          { id: 1, text: 'Completed 1', completed: true, indent: 0 },
          { id: 2, text: 'Completed 2', completed: true, indent: 0 },
          { id: 3, text: 'Active', completed: false, indent: 0 },
        ];

        const { result } = renderHook(() =>
          useTodoKeyboardHandlers({
            ...defaultProps,
            allTodos: allCompleted,
            hideCompletedItems: true,
          }),
        );

        const handler = result.current(3);
        const textarea = document.createElement('textarea');
        textarea.value = 'Active';
        textarea.setSelectionRange(0, 0); // Cursor at start

        const mockEvent = {
          key: 'Backspace',
          preventDefault: jest.fn(),
          currentTarget: textarea,
        } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

        handler(mockEvent);

        // Should not merge (no valid visible target)
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(mockUpdateTodo).not.toHaveBeenCalled();
        expect(mockRemoveTodoAt).not.toHaveBeenCalled();
      });

      it('should skip completed child when parent is completed (bug scenario)', () => {
        // Scenario: item 1, item 2 (completed), item a (completed child of item 2), item 3
        // When backspacing from item 3, should merge with item 1, not item a
        const todosWithCompletedParent: EditorTodo[] = [
          {
            id: 1,
            text: 'item 1',
            completed: false,
            indent: 0,
            parentId: null,
          },
          { id: 2, text: 'item 2', completed: true, indent: 0, parentId: null },
          { id: 3, text: 'item a', completed: true, indent: 0, parentId: 2 },
          {
            id: 4,
            text: 'item 3',
            completed: false,
            indent: 0,
            parentId: null,
          },
        ];

        const { result } = renderHook(() =>
          useTodoKeyboardHandlers({
            ...defaultProps,
            allTodos: todosWithCompletedParent,
            hideCompletedItems: true,
          }),
        );

        const handler = result.current(4); // item 3
        const textarea = document.createElement('textarea');
        textarea.value = 'item 3';
        textarea.setSelectionRange(0, 0); // Cursor at start

        const mockEvent = {
          key: 'Backspace',
          preventDefault: jest.fn(),
          currentTarget: textarea,
        } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

        handler(mockEvent);

        // Should skip item a (completed) and item 2 (completed), merge with item 1
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockUpdateTodo).toHaveBeenCalledWith(1, 'item 1item 3');
        expect(mockRemoveTodoAt).toHaveBeenCalledWith(3); // Index of item 3
        expect(mockFocusTodo).toHaveBeenCalledWith(1, 6); // Focus at junction (length of "item 1")
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty todos array', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({ ...defaultProps, allTodos: [] }),
      );

      const handler = result.current(1);
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      // Should not crash and not call any actions
      expect(mockInsertTodoBelow).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });

    it('should handle todos with undefined indent', () => {
      const todosWithUndefinedIndent = [
        { id: 1, text: 'Todo with undefined indent', completed: false },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosWithUndefinedIndent,
        }),
      );

      const handler = result.current(1);
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).not.toHaveBeenCalled(); // No parent above
    });

    it('should handle todos with null indent', () => {
      const todosWithNullIndent = [
        {
          id: 1,
          text: 'Todo with null indent',
          completed: false,
          indent: undefined,
        },
      ];

      const { result } = renderHook(() =>
        useTodoKeyboardHandlers({
          ...defaultProps,
          allTodos: todosWithNullIndent,
        }),
      );

      const handler = result.current(1);
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).not.toHaveBeenCalled(); // No parent above
    });

    it('should handle unknown keys gracefully', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1);
      const mockEvent = {
        key: 'Escape',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      // Should not call any actions for unknown keys
      expect(mockChangeIndent).not.toHaveBeenCalled();
      expect(mockInsertTodoBelow).not.toHaveBeenCalled();
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
    });
  });
});
