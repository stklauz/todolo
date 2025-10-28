import React from 'react';
import type { EditorTodo, Section } from '../types';
import { computeSectionById, isChildOf } from '../utils/todoUtils';
import { debugLogger } from '../../../utils/debug';

type GetTodos = () => EditorTodo[];
type SetTodos = (updater: (prev: EditorTodo[]) => EditorTodo[]) => void;

export default function useDragReorder(
  getTodos: GetTodos,
  setTodos: SetTodos,
  sectionOf: (id: number) => Section,
) {
  const [dragInfo, setDragInfo] = React.useState<{
    id: number;
    section: Section;
  } | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<number | null>(null);
  const [dropAtSectionEnd, setDropAtSectionEnd] =
    React.useState<Section | null>(null);

  // Use a ref to store the current drag info so it's always accessible in callbacks
  const dragInfoRef = React.useRef<{ id: number; section: Section } | null>(
    null,
  );

  // Keep the ref in sync with the state
  React.useEffect(() => {
    dragInfoRef.current = dragInfo;
  }, [dragInfo]);

  // Helper function to check if targetId is a child of sourceId
  const checkIsChildOf = React.useCallback(
    (sourceId: number, targetId: number): boolean => {
      const todos = getTodos();
      return isChildOf(sourceId, targetId, todos);
    },
    [getTodos],
  );

  const handleDragStart = React.useCallback(
    (id: number) => {
      const section = sectionOf(id);
      debugLogger.log('info', 'Drag start', { id, section });
      setDragInfo({ id, section });
      setDropTargetId(null);
      setDropAtSectionEnd(null);
    },
    [sectionOf],
  );

  const handleDragEnd = React.useCallback(() => {
    debugLogger.log('info', 'Drag end', { dragInfo });
    setDragInfo(null);
    setDropTargetId(null);
    setDropAtSectionEnd(null);
  }, [dragInfo]);

  const handleDragOver = React.useCallback(
    (event: React.DragEvent, targetId: number) => {
      event.preventDefault();
      const currentDragInfo = dragInfoRef.current;

      if (!currentDragInfo) {
        return;
      }
      if (targetId === currentDragInfo.id) {
        setDropTargetId(null);
        return;
      }
      const targetSection = sectionOf(targetId);
      if (targetSection !== currentDragInfo.section) {
        setDropTargetId(null);
        return;
      }

      // Check if trying to drop parent under its child - prevent this
      if (checkIsChildOf(currentDragInfo.id, targetId)) {
        setDropTargetId(null);
        return;
      }

      setDropTargetId(targetId);
      setDropAtSectionEnd(null);
    },
    [sectionOf, checkIsChildOf],
  );

  const handleDragLeave = React.useCallback((targetId: number) => {
    setDropTargetId((prev) => (prev === targetId ? null : prev));
  }, []);

  const handleDropOn = React.useCallback(
    (targetId: number) => {
      const currentDragInfo = dragInfoRef.current;
      if (!currentDragInfo) {
        return;
      }
      const sourceId = currentDragInfo.id;
      const targetSection = sectionOf(targetId);
      if (targetSection !== currentDragInfo.section) {
        return handleDragEnd();
      }
      if (sourceId === targetId) {
        return handleDragEnd();
      }

      // Check if trying to drop parent under its child - prevent this
      if (checkIsChildOf(sourceId, targetId)) {
        return handleDragEnd();
      }

      debugLogger.log('info', 'Processing drop', { sourceId, targetId });
      setTodos((prev) => {
        const srcIndex0 = prev.findIndex((t) => t.id === sourceId);
        const tgtIndex0 = prev.findIndex((t) => t.id === targetId);
        if (srcIndex0 === -1 || tgtIndex0 === -1) return prev;
        if (
          computeSectionById(sourceId, prev) !==
          computeSectionById(targetId, prev)
        )
          return prev;
        const next = [...prev];
        // compute source block
        const srcIsParent = Number(next[srcIndex0].indent ?? 0) === 0;
        const srcStart = srcIsParent ? srcIndex0 : srcIndex0;
        let srcEnd = srcIndex0;
        if (srcIsParent) {
          for (let i = srcIndex0 + 1; i < next.length; i++) {
            if (Number(next[i].indent ?? 0) === 0) break;
            srcEnd = i;
          }
        }
        // If target is inside source block, ignore
        if (tgtIndex0 >= srcStart && tgtIndex0 <= srcEnd) return prev;
        // extract block
        const block = next.splice(srcStart, srcEnd - srcStart + 1);
        // compute target block start
        // When dropping onto a child, insert at the child's row (do not snap to parent)
        // This preserves child-group ordering and allows inserting a parent between children
        let tgtIndex = tgtIndex0;
        // adjust target index after removal
        if (tgtIndex0 > srcEnd) {
          tgtIndex -= block.length;
        }
        // insert before target row (or parent row, if target was a parent)
        next.splice(tgtIndex, 0, ...block);
        // Ensure no orphan children for child moves
        if (!srcIsParent) {
          const movedIndex = next.findIndex((t) => t.id === sourceId);
          if (movedIndex !== -1 && Number(next[movedIndex].indent ?? 0) === 1) {
            let hasParent = false;
            for (let i = movedIndex - 1; i >= 0; i--) {
              if (Number(next[i].indent ?? 0) === 0) {
                hasParent = true;
                break;
              }
            }
            if (!hasParent)
              next[movedIndex] = { ...next[movedIndex], indent: 0 };
          }
        }
        return next;
      });
      handleDragEnd();
    },
    [handleDragEnd, sectionOf, setTodos, checkIsChildOf],
  );

  const handleDragOverEndZone = React.useCallback(
    (event: React.DragEvent, section: Section) => {
      event.preventDefault();
      const currentDragInfo = dragInfoRef.current;
      if (!currentDragInfo || currentDragInfo.section !== section) {
        setDropAtSectionEnd(null);
        return;
      }
      setDropTargetId(null);
      setDropAtSectionEnd(section);
    },
    [],
  );

  const handleDragLeaveEndZone = React.useCallback((section: Section) => {
    setDropAtSectionEnd((prev) => (prev === section ? null : prev));
  }, []);

  const handleDropAtEnd = React.useCallback(
    (section: Section) => {
      const currentDragInfo = dragInfoRef.current;
      if (!currentDragInfo || currentDragInfo.section !== section) {
        return;
      }
      const sourceId = currentDragInfo.id;
      debugLogger.log('info', 'Processing drop at end', { sourceId, section });
      setTodos((prev) => {
        const srcIndex0 = prev.findIndex((t) => t.id === sourceId);
        if (srcIndex0 === -1) return prev;
        const next = [...prev];
        const srcIsParent = Number(next[srcIndex0].indent ?? 0) === 0;
        const srcStart = srcIndex0;
        let srcEnd = srcIndex0;
        if (srcIsParent) {
          for (let i = srcIndex0 + 1; i < next.length; i++) {
            if (Number(next[i].indent ?? 0) === 0) break;
            srcEnd = i;
          }
        }
        const block = next.splice(srcStart, srcEnd - srcStart + 1);
        // find last index in the desired section
        let lastIdx = -1;
        for (let i = next.length - 1; i >= 0; i--) {
          if (computeSectionById(next[i].id, next) === section) {
            lastIdx = i;
            break;
          }
        }
        next.splice(lastIdx + 1, 0, ...block);
        // orphan fix for child-only moves
        if (!srcIsParent) {
          const movedIndex = next.findIndex((t) => t.id === sourceId);
          if (movedIndex !== -1 && Number(next[movedIndex].indent ?? 0) === 1) {
            let hasParent = false;
            for (let i = movedIndex - 1; i >= 0; i--) {
              if (Number(next[i].indent ?? 0) === 0) {
                hasParent = true;
                break;
              }
            }
            if (!hasParent)
              next[movedIndex] = { ...next[movedIndex], indent: 0 };
          }
        }
        return next;
      });
      handleDragEnd();
    },
    [handleDragEnd, setTodos],
  );

  return {
    dragInfo,
    dropTargetId,
    dropAtSectionEnd,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDropOn,
    handleDragOverEndZone,
    handleDragLeaveEndZone,
    handleDropAtEnd,
  } as const;
}
