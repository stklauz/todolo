import React from 'react';
import { renderHook, act } from '@testing-library/react';
import useDragReorder from '../useDragReorder';
import type { EditorTodo, Section } from '../../types';
import { debugLogger } from '../../../../utils/debug';

// Mock the debug logger
jest.mock('../../../../utils/debug');
const mockDebugLogger = debugLogger as jest.Mocked<typeof debugLogger>;

describe('useDragReorder', () => {
  const mockTodos: EditorTodo[] = [
    { id: 1, text: 'Parent 1', completed: false, indent: 0 },
    { id: 2, text: 'Child 1.1', completed: false, indent: 1 },
    { id: 3, text: 'Child 1.2', completed: false, indent: 1 },
    { id: 4, text: 'Parent 2', completed: false, indent: 0 },
    { id: 5, text: 'Child 2.1', completed: false, indent: 1 },
    { id: 6, text: 'Completed Parent', completed: true, indent: 0 },
    { id: 7, text: 'Completed Child', completed: true, indent: 1 },
  ];

  const mockGetTodos = jest.fn(() => mockTodos);
  const mockSetTodos = jest.fn();
  const mockSectionOf = jest.fn((id: number): Section => {
    // Simple mapping for testing
    if (id === 6 || id === 7) return 'completed'; // Completed parent and child
    return 'active'; // Everything else is active
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTodos.mockReturnValue(mockTodos);
    mockSetTodos.mockImplementation((updater) => {
      const newTodos = updater(mockTodos);
      mockGetTodos.mockReturnValue(newTodos);
    });
    // Reset the section mock to return the expected values
    mockSectionOf.mockImplementation((id: number): Section => {
      if (id === 6 || id === 7) return 'completed';
      return 'active';
    });
  });

  describe('Initial State', () => {
    it('should initialize with null drag info and no drop targets', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      expect(result.current.dragInfo).toBeNull();
      expect(result.current.dropTargetId).toBeNull();
      expect(result.current.dropAtSectionEnd).toBeNull();
    });
  });

  describe('Drag Start', () => {
    it('should set drag info when drag starts', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      expect(result.current.dragInfo).toEqual({ id: 1, section: 'active' });
      expect(result.current.dropTargetId).toBeNull();
      expect(result.current.dropAtSectionEnd).toBeNull();
      expect(mockDebugLogger.log).toHaveBeenCalledWith('info', 'Drag start', {
        id: 1,
        section: 'active',
      });
    });

    it('should clear previous drop targets when drag starts', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      // Set up some state first
      act(() => {
        result.current.handleDragStart(1);
      });

      act(() => {
        result.current.handleDragStart(2);
      });

      expect(result.current.dragInfo).toEqual({ id: 2, section: 'active' });
      expect(result.current.dropTargetId).toBeNull();
      expect(result.current.dropAtSectionEnd).toBeNull();
    });
  });

  describe('Drag End', () => {
    it('should clear all drag state when drag ends', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      // Set up drag state
      act(() => {
        result.current.handleDragStart(1);
      });

      act(() => {
        result.current.handleDragEnd();
      });

      expect(result.current.dragInfo).toBeNull();
      expect(result.current.dropTargetId).toBeNull();
      expect(result.current.dropAtSectionEnd).toBeNull();
      expect(mockDebugLogger.log).toHaveBeenCalledWith('info', 'Drag end', {
        dragInfo: { id: 1, section: 'active' },
      });
    });
  });

  describe('Drag Over', () => {
    it('should set drop target for valid drop', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent, 4);
      });

      expect(result.current.dropTargetId).toBe(4);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not set drop target when dragging over self', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent, 1);
      });

      expect(result.current.dropTargetId).toBeNull();
    });

    it('should not set drop target when dragging across sections', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // active section
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent, 6); // completed section
      });

      // Should not set drop target when sections don't match
      expect(result.current.dropTargetId).toBeNull();
    });

    it('should not set drop target when trying to drop parent under child', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // parent
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent, 2); // child of parent 1
      });

      expect(result.current.dropTargetId).toBeNull();
    });

    it('should not set drop target when no drag is active', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent, 4);
      });

      expect(result.current.dropTargetId).toBeNull();
    });
  });

  describe('Drag Leave', () => {
    it('should clear drop target when leaving the same target', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent, 4);
      });

      expect(result.current.dropTargetId).toBe(4);

      act(() => {
        result.current.handleDragLeave(4);
      });

      expect(result.current.dropTargetId).toBeNull();
    });

    it('should not clear drop target when leaving different target', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent, 4);
      });

      expect(result.current.dropTargetId).toBe(4);

      act(() => {
        result.current.handleDragLeave(5);
      });

      expect(result.current.dropTargetId).toBe(4);
    });
  });

  describe('Drop On', () => {
    it('should reorder parent block when dropping on another parent', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // Parent 1 with children
      });

      act(() => {
        result.current.handleDropOn(4); // Parent 2
      });

      expect(mockSetTodos).toHaveBeenCalled();
      expect(mockDebugLogger.log).toHaveBeenCalledWith(
        'info',
        'Processing drop',
        { sourceId: 1, targetId: 4 },
      );
    });

    it('should reorder single child when dropping on another item', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(2); // Child 1.1
      });

      act(() => {
        result.current.handleDropOn(5); // Child 2.1
      });

      expect(mockSetTodos).toHaveBeenCalled();
    });

    it('should not reorder when dropping on self', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      act(() => {
        result.current.handleDropOn(1);
      });

      expect(mockSetTodos).not.toHaveBeenCalled();
    });

    it('should not reorder when dropping across sections', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // active section
      });

      act(() => {
        result.current.handleDropOn(6); // completed section
      });

      // Should not reorder when sections don't match
      expect(mockSetTodos).not.toHaveBeenCalled();
    });

    it('should not reorder when dropping parent under its child', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // parent
      });

      act(() => {
        result.current.handleDropOn(2); // child of parent 1
      });

      expect(mockSetTodos).not.toHaveBeenCalled();
    });

    it('should not reorder when no drag is active', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDropOn(4);
      });

      expect(mockSetTodos).not.toHaveBeenCalled();
    });

    it('should handle missing source or target IDs gracefully', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(999); // non-existent
      });

      act(() => {
        result.current.handleDropOn(4);
      });

      // The implementation will call setTodos but the updater function will return prev
      // when source or target indices are not found
      expect(mockSetTodos).toHaveBeenCalled();
    });
  });

  describe('End Zone Interactions', () => {
    it('should set drop at section end when dragging over end zone', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // active section
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOverEndZone(mockEvent, 'active');
      });

      // The drag info section should match the target section
      expect(result.current.dropAtSectionEnd).toBe('active');
      expect(result.current.dropTargetId).toBeNull();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not set drop at section end when dragging over different section end zone', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // active section
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOverEndZone(mockEvent, 'completed');
      });

      expect(result.current.dropAtSectionEnd).toBeNull();
    });

    it('should clear drop at section end when leaving end zone', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOverEndZone(mockEvent, 'active');
      });

      expect(result.current.dropAtSectionEnd).toBe('active');

      act(() => {
        result.current.handleDragLeaveEndZone('active');
      });

      expect(result.current.dropAtSectionEnd).toBeNull();
    });

    it('should not clear drop at section end when leaving different end zone', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOverEndZone(mockEvent, 'active');
      });

      expect(result.current.dropAtSectionEnd).toBe('active');

      act(() => {
        result.current.handleDragLeaveEndZone('completed');
      });

      expect(result.current.dropAtSectionEnd).toBe('active');
    });
  });

  describe('Drop At End', () => {
    it('should move parent block to end of section', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // Parent 1 with children
      });

      act(() => {
        result.current.handleDropAtEnd('active');
      });

      expect(mockSetTodos).toHaveBeenCalled();
      expect(mockDebugLogger.log).toHaveBeenCalledWith(
        'info',
        'Processing drop at end',
        { sourceId: 1, section: 'active' },
      );
    });

    it('should move single child to end of section', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(2); // Child 1.1
      });

      act(() => {
        result.current.handleDropAtEnd('active');
      });

      expect(mockSetTodos).toHaveBeenCalled();
    });

    it('should not move when dropping at different section end', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // active section
      });

      act(() => {
        result.current.handleDropAtEnd('completed');
      });

      expect(mockSetTodos).not.toHaveBeenCalled();
    });

    it('should not move when no drag is active', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDropAtEnd('active');
      });

      expect(mockSetTodos).not.toHaveBeenCalled();
    });
  });

  describe('Business Rules - Parent-Child Block Integrity', () => {
    it('should move entire parent block including all children', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // Parent 1 with children 2, 3
      });

      act(() => {
        result.current.handleDropOn(4); // Parent 2
      });

      const setTodosCall = mockSetTodos.mock.calls[0][0];
      const newTodos = setTodosCall(mockTodos);

      // Find the moved block
      const parent1Index = newTodos.findIndex((t: EditorTodo) => t.id === 1);
      const child1Index = newTodos.findIndex((t: EditorTodo) => t.id === 2);
      const child2Index = newTodos.findIndex((t: EditorTodo) => t.id === 3);

      // All should be moved together and in order
      expect(parent1Index).toBeLessThan(child1Index);
      expect(child1Index).toBeLessThan(child2Index);
    });

    it('should prevent dropping into own block', () => {
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1); // Parent 1
      });

      act(() => {
        result.current.handleDropOn(2); // Child 1.1 (inside parent 1's block)
      });

      expect(mockSetTodos).not.toHaveBeenCalled();
    });

    it('should fix orphaned children by outdenting them', () => {
      // Create a test scenario where a child will be orphaned after move
      const orphanedTodos: EditorTodo[] = [
        { id: 1, text: 'Parent 1', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Parent 2', completed: false, indent: 0 },
        { id: 4, text: 'Child 2', completed: false, indent: 1 },
      ];

      mockGetTodos.mockReturnValue(orphanedTodos);
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(2); // Child 1 - move it to after Parent 2
      });

      act(() => {
        result.current.handleDropOn(3); // Drop on Parent 2
      });

      const setTodosCall = mockSetTodos.mock.calls[0][0];
      const newTodos = setTodosCall(orphanedTodos);

      const movedChild = newTodos.find((t: EditorTodo) => t.id === 2);
      // The child should be outdented to 0 when it has no parent after the move
      expect(movedChild?.indent).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty todos list gracefully', () => {
      mockGetTodos.mockReturnValue([]);
      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      act(() => {
        result.current.handleDropOn(2);
      });

      // The implementation will call setTodos but the updater function will return prev
      // when source or target indices are not found (which they won't be in empty list)
      expect(mockSetTodos).toHaveBeenCalled();
    });

    it('should handle todos with undefined indent', () => {
      const todosWithUndefinedIndent: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 1 },
        { id: 2, text: 'Todo 2', completed: false }, // no indent property (undefined)
      ];

      mockGetTodos.mockReturnValue(todosWithUndefinedIndent);
      // Override the section mock for this specific test
      const customSectionOf = jest.fn((id: number): Section => {
        return 'active'; // Both todos should be in active section
      });

      const { result } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, customSectionOf),
      );

      act(() => {
        result.current.handleDragStart(1);
      });

      act(() => {
        result.current.handleDropOn(2);
      });

      // The implementation should handle undefined indent values by treating them as 0
      // and should call setTodos for the reorder operation
      expect(mockSetTodos).toHaveBeenCalled();
    });

    it('should maintain referential stability of callbacks', () => {
      const { result, rerender } = renderHook(() =>
        useDragReorder(mockGetTodos, mockSetTodos, mockSectionOf),
      );

      const initialCallbacks = {
        handleDragStart: result.current.handleDragStart,
        handleDragEnd: result.current.handleDragEnd,
        handleDragOver: result.current.handleDragOver,
        handleDragLeave: result.current.handleDragLeave,
        handleDropOn: result.current.handleDropOn,
        handleDragOverEndZone: result.current.handleDragOverEndZone,
        handleDragLeaveEndZone: result.current.handleDragLeaveEndZone,
        handleDropAtEnd: result.current.handleDropAtEnd,
      };

      rerender();

      expect(result.current.handleDragStart).toBe(
        initialCallbacks.handleDragStart,
      );
      expect(result.current.handleDragEnd).toBe(initialCallbacks.handleDragEnd);
      expect(result.current.handleDragOver).toBe(
        initialCallbacks.handleDragOver,
      );
      expect(result.current.handleDragLeave).toBe(
        initialCallbacks.handleDragLeave,
      );
      expect(result.current.handleDropOn).toBe(initialCallbacks.handleDropOn);
      expect(result.current.handleDragOverEndZone).toBe(
        initialCallbacks.handleDragOverEndZone,
      );
      expect(result.current.handleDragLeaveEndZone).toBe(
        initialCallbacks.handleDragLeaveEndZone,
      );
      expect(result.current.handleDropAtEnd).toBe(
        initialCallbacks.handleDropAtEnd,
      );
    });
  });
});
