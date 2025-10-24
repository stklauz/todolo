// src/renderer/features/todos/hooks/__tests__/useTimeout.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTimeout } from '../useTimeout';

describe('useTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with a function to set timeouts', () => {
    const { result } = renderHook(() => useTimeout());

    expect(typeof result.current).toBe('function');
  });

  it('should clear previous timeout when setting a new one', () => {
    const { result } = renderHook(() => useTimeout());
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    // Set first timeout
    act(() => {
      result.current(callback1, 1000);
    });

    // Set second timeout before first completes
    act(() => {
      result.current(callback2, 1000);
    });

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Only the second callback should have been called
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  it('should clean up timeout on unmount', () => {
    const callback = jest.fn();
    const { result, unmount } = renderHook(() => useTimeout());

    act(() => {
      result.current(callback, 1000);
    });

    // Unmount before timeout completes
    unmount();

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Callback should not have been called
    expect(callback).not.toHaveBeenCalled();
  });

  it('should execute callback after specified delay', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useTimeout());

    act(() => {
      result.current(callback, 500);
    });

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
