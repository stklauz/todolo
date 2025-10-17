import { renderHook, act } from '@testing-library/react';
import useTodoFocus, { useTodoFocusEffect } from '../useTodoFocus';
import type { EditorTodo } from '../../types';

describe('useTodoFocus', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useTodoFocus());

    expect(result.current.inputByIdRef.current.size).toBe(0);
    expect(result.current.focusNextIdRef.current).toBe(null);
  });

  it('should set input ref', () => {
    const { result } = renderHook(() => useTodoFocus());
    const mockElement = document.createElement('textarea');

    act(() => {
      result.current.setInputRef(1, mockElement);
    });

    expect(result.current.inputByIdRef.current.get(1)).toBe(mockElement);
  });

  it('should remove input ref when set to null', () => {
    const { result } = renderHook(() => useTodoFocus());
    const mockElement = document.createElement('textarea');

    act(() => {
      result.current.setInputRef(1, mockElement);
      result.current.setInputRef(1, null);
    });

    expect(result.current.inputByIdRef.current.get(1)).toBeUndefined();
  });

  it('should set focus todo id', () => {
    const { result } = renderHook(() => useTodoFocus());

    act(() => {
      result.current.focusTodo(123);
    });

    expect(result.current.focusNextIdRef.current).toBe(123);
  });

  it('should clear focus', () => {
    const { result } = renderHook(() => useTodoFocus());

    act(() => {
      result.current.focusTodo(123);
      result.current.clearFocus();
    });

    expect(result.current.focusNextIdRef.current).toBe(null);
  });
});

describe('useTodoFocusEffect', () => {
  it('should focus todo when focusNextIdRef is set', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'Todo 1', completed: false, indent: 0 },
      { id: 2, text: 'Todo 2', completed: false, indent: 0 },
    ];
    const focusNextIdRef = { current: 2 };
    const inputByIdRef = { current: new Map() };
    const mockElement = document.createElement('textarea');
    inputByIdRef.current.set(2, mockElement);
    const focusSpy = jest.spyOn(mockElement, 'focus');

    renderHook(() => useTodoFocusEffect(todos, focusNextIdRef, inputByIdRef));

    expect(focusSpy).toHaveBeenCalled();
    expect(focusNextIdRef.current).toBe(null);
  });

  it('should focus single todo when no focus id is set', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'Todo 1', completed: false, indent: 0 },
    ];
    const focusNextIdRef = { current: null };
    const inputByIdRef = { current: new Map() };
    const mockElement = document.createElement('textarea');
    inputByIdRef.current.set(1, mockElement);
    const focusSpy = jest.spyOn(mockElement, 'focus');

    renderHook(() => useTodoFocusEffect(todos, focusNextIdRef, inputByIdRef));

    expect(focusSpy).toHaveBeenCalled();
  });

  it('should not focus when editing title', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'Todo 1', completed: false, indent: 0 },
    ];
    const focusNextIdRef = { current: 1 };
    const inputByIdRef = { current: new Map() };
    const mockElement = document.createElement('textarea');
    inputByIdRef.current.set(1, mockElement);
    const focusSpy = jest.spyOn(mockElement, 'focus');
    const isEditingRef = { current: true };

    renderHook(() =>
      useTodoFocusEffect(todos, focusNextIdRef, inputByIdRef, isEditingRef),
    );

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('should not focus when element is not found', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'Todo 1', completed: false, indent: 0 },
    ];
    const focusNextIdRef = { current: 999 };
    const inputByIdRef = { current: new Map() };
    const mockElement = document.createElement('textarea');
    inputByIdRef.current.set(1, mockElement);
    const focusSpy = jest.spyOn(mockElement, 'focus');

    renderHook(() => useTodoFocusEffect(todos, focusNextIdRef, inputByIdRef));

    expect(focusSpy).not.toHaveBeenCalled();
    expect(focusNextIdRef.current).toBe(999); // Should not be cleared
  });
});
