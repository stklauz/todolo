import React from 'react';
import { renderHook, fireEvent } from '@testing-library/react';
import useTodoKeyboardHandlers from '../useTodoKeyboardHandlers';
import type { EditorTodo } from '../../types';

describe('useTodoKeyboardHandlers', () => {
  const mockTodos: EditorTodo[] = [
    { id: 1, text: 'Parent 1', completed: false, indent: 0 },
    { id: 2, text: 'Child 1.1', completed: false, indent: 1 },
    { id: 3, text: 'Child 1.2', completed: false, indent: 1 },
    { id: 4, text: 'Parent 2', completed: false, indent: 0 },
    { id: 5, text: '', completed: false, indent: 0 },
  ];

  const mockChangeIndent = jest.fn();
  const mockInsertTodoBelow = jest.fn();
  const mockRemoveTodoAt = jest.fn();
  const mockFocusTodo = jest.fn();

  const defaultProps = {
    allTodos: mockTodos,
    changeIndent: mockChangeIndent,
    insertTodoBelow: mockInsertTodoBelow,
    removeTodoAt: mockRemoveTodoAt,
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

    it('should indent when Tab is pressed and parent exists above', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(2); // Child todo
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChangeIndent).toHaveBeenCalledWith(2, +1);
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
  });

  describe('Enter key handling', () => {
    it('should create new todo when Enter is pressed on non-empty todo', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1); // Parent todo with text
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockInsertTodoBelow).toHaveBeenCalledWith(0, ''); // Index of todo with id 1
      expect(mockFocusTodo).toHaveBeenCalledWith(999); // Mock return value
    });

    it('should not create new todo when Enter is pressed on empty todo', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(5); // Empty todo
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
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
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockInsertTodoBelow).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
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
      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
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
      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
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
      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
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
      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockRemoveTodoAt).toHaveBeenCalledWith(3);
      expect(mockFocusTodo).toHaveBeenCalledWith(3); // Previous todo (Child 1.2)
    });

    it('should not prevent default when Backspace is pressed on non-empty todo', () => {
      const { result } = renderHook(() =>
        useTodoKeyboardHandlers(defaultProps),
      );

      const handler = result.current(1); // Non-empty todo
      const mockEvent = {
        key: 'Backspace',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      handler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockChangeIndent).not.toHaveBeenCalled();
      expect(mockRemoveTodoAt).not.toHaveBeenCalled();
      expect(mockFocusTodo).not.toHaveBeenCalled();
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
