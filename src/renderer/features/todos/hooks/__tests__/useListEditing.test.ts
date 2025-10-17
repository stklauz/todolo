import { renderHook, act } from '@testing-library/react';
import useListEditing from '../useListEditing';

describe('useListEditing', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useListEditing());

    expect(result.current.editingListId).toBe(null);
    expect(result.current.editingName).toBe('');
    expect(result.current.inputJustFocusedRef.current).toBe(false);
    expect(result.current.titleInputRef.current).toBe(null);
    expect(result.current.isEditingRef.current).toBe(false);
  });

  it('should start rename editing', () => {
    const { result } = renderHook(() => useListEditing());

    act(() => {
      result.current.startRename('list-1', 'My List');
    });

    expect(result.current.editingListId).toBe('list-1');
    expect(result.current.editingName).toBe('My List');
    expect(result.current.isEditingRef.current).toBe(true);
  });

  it('should commit rename with valid name', () => {
    const { result } = renderHook(() => useListEditing());

    act(() => {
      result.current.startRename('list-1', 'My List');
    });

    act(() => {
      result.current.setEditingName('New Name');
    });

    act(() => {
      result.current.commitRename();
    });

    expect(result.current.editingListId).toBe(null);
    expect(result.current.isEditingRef.current).toBe(false);
  });

  it('should cancel rename with empty name', () => {
    const { result } = renderHook(() => useListEditing());

    act(() => {
      result.current.startRename('list-1', 'My List');
    });

    act(() => {
      result.current.setEditingName('   '); // Empty after trim
    });

    act(() => {
      result.current.commitRename();
    });

    expect(result.current.editingListId).toBe(null);
    expect(result.current.isEditingRef.current).toBe(false);
  });

  it('should cancel rename', () => {
    const { result } = renderHook(() => useListEditing());

    act(() => {
      result.current.startRename('list-1', 'My List');
      result.current.cancelRename();
    });

    expect(result.current.editingListId).toBe(null);
    expect(result.current.isEditingRef.current).toBe(false);
  });

  it('should not commit rename if not editing', () => {
    const { result } = renderHook(() => useListEditing());

    act(() => {
      result.current.commitRename();
    });

    expect(result.current.editingListId).toBe(null);
    expect(result.current.isEditingRef.current).toBe(false);
  });

  it('should update editing name', () => {
    const { result } = renderHook(() => useListEditing());

    act(() => {
      result.current.setEditingName('New Name');
    });

    expect(result.current.editingName).toBe('New Name');
  });
});
