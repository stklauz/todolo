import { renderHook, act } from '@testing-library/react';
import useListDuplication from '../useListDuplication';

describe('useListDuplication', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useListDuplication());

    expect(result.current.isDuplicating).toBe(false);
    expect(result.current.statusMessage).toBe(null);
    expect(result.current.focusListId).toBe(null);
  });

  it('should handle successful duplication', async () => {
    const { result } = renderHook(() => useListDuplication());
    const mockDuplicateList = jest.fn().mockResolvedValue('new-list-id');

    await act(async () => {
      await result.current.handleDuplicate('list-1', mockDuplicateList);
    });

    expect(mockDuplicateList).toHaveBeenCalledWith('list-1');
    expect(result.current.isDuplicating).toBe(false);
    expect(result.current.statusMessage).toBe('List duplicated');
    expect(result.current.focusListId).toBe('new-list-id');
  });

  it('should handle failed duplication', async () => {
    const { result } = renderHook(() => useListDuplication());
    const mockDuplicateList = jest.fn().mockResolvedValue(null);

    await act(async () => {
      await result.current.handleDuplicate('list-1', mockDuplicateList);
    });

    expect(mockDuplicateList).toHaveBeenCalledWith('list-1');
    expect(result.current.isDuplicating).toBe(false);
    expect(result.current.statusMessage).toBe(
      "Couldn't duplicate this list. Try again.",
    );
    expect(result.current.focusListId).toBe(null);
  });

  it('should not duplicate if already duplicating', async () => {
    const { result } = renderHook(() => useListDuplication());
    const mockDuplicateList = jest.fn().mockResolvedValue('new-list-id');

    // Start first duplication
    act(() => {
      result.current.handleDuplicate('list-1', mockDuplicateList);
    });

    // Try to start second duplication
    await act(async () => {
      await result.current.handleDuplicate('list-2', mockDuplicateList);
    });

    // Should only have been called once
    expect(mockDuplicateList).toHaveBeenCalledTimes(1);
  });

  it('should not duplicate if no selectedListId', async () => {
    const { result } = renderHook(() => useListDuplication());
    const mockDuplicateList = jest.fn().mockResolvedValue('new-list-id');

    await act(async () => {
      await result.current.handleDuplicate('', mockDuplicateList);
    });

    expect(mockDuplicateList).not.toHaveBeenCalled();
  });

  it('should set focus list id', () => {
    const { result } = renderHook(() => useListDuplication());

    act(() => {
      result.current.setFocusListId('list-1');
    });

    expect(result.current.focusListId).toBe('list-1');
  });

  it('should clear focus after timeout', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useListDuplication());

    act(() => {
      result.current.setFocusListId('list-1');
    });

    expect(result.current.focusListId).toBe('list-1');

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.focusListId).toBe(null);

    jest.useRealTimers();
  });
});
