import React from 'react';
import type { EditorTodo, Section } from '../types';
import { computeSectionById } from '../utils/todoUtils';
import {
  extractTodoBlock,
  insertTodoBlock,
  isChildOf,
  validateDragOperation,
} from '../utils/dragDropUtils';
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

      // Prevent hovering a parent over its own child
      const todos = getTodos();
      if (isChildOf(currentDragInfo.id, targetId, todos)) {
        setDropTargetId(null);
        return;
      }

      setDropTargetId(targetId);
      setDropAtSectionEnd(null);
    },
    [getTodos, sectionOf],
  );

  const handleDragLeave = React.useCallback((targetId: number) => {
    setDropTargetId((prev) => (prev === targetId ? null : prev));
  }, []);

  const handleDropOn = React.useCallback(
    (targetId: number) => {
      const currentDragInfo = dragInfoRef.current;
      debugLogger.log('info', 'handleDropOn called', {
        currentDragInfo,
        targetId,
      });
      if (!currentDragInfo) {
        debugLogger.log('warn', 'No drag info available, aborting drop');
        return;
      }
      const sourceId = currentDragInfo.id;
      const todos = getTodos();
      const { valid, reason } = validateDragOperation(
        sourceId,
        targetId,
        todos,
      );
      if (!valid) {
        debugLogger.log('info', 'Drop validation failed', {
          sourceId,
          targetId,
          reason,
        });
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
        const { block, endIndex: srcEnd } = extractTodoBlock(prev, srcIndex0);
        // If target is inside source block, ignore
        if (tgtIndex0 >= srcIndex0 && tgtIndex0 <= srcEnd) return prev;
        // remove block
        const withoutBlock = prev.filter(
          (_todo, index) => index < srcIndex0 || index > srcEnd,
        );
        // compute target block start
        // When dropping onto a child, insert at the child's row (do not snap to parent)
        // This preserves child-group ordering and allows inserting a parent between children.
        let tgtIndex = tgtIndex0;
        // adjust target index after removal; for downward moves we still want
        // to insert the block at the target's position (so the target shifts down).
        if (tgtIndex0 > srcEnd) {
          tgtIndex -= block.length;
        }
        // insert at computed index
        const next = insertTodoBlock(withoutBlock, block, tgtIndex);

        // Normalize overly deep indentation when dropping under a shallower target.
        const movedIndex = next.findIndex((t) => t.id === sourceId);
        const targetIndex = next.findIndex((t) => t.id === targetId);
        const movedIndent =
          movedIndex !== -1 ? Number(next[movedIndex].indent ?? 0) : 0;
        if (movedIndex !== -1 && targetIndex !== -1) {
          const targetIndent = Number(next[targetIndex].indent ?? 0);
          if (movedIndent > targetIndent + 1) {
            next[movedIndex] = {
              ...next[movedIndex],
              indent: targetIndent + 1,
            } as any;
          }
        }

        // Ensure no orphan children for single-row level-1 child moves and set parentId accordingly.
        // Only apply this when we moved a single row at indent 1; multi-row blocks
        // and deeper descendants preserve their existing parent/child relationships.
        const srcStart = srcIndex0;
        const movedWasSingleLevel1Child =
          movedIndex !== -1 && srcStart === srcEnd && movedIndent === 1;
        if (movedWasSingleLevel1Child && movedIndex !== -1) {
          debugLogger.log('info', 'Handling child move', {
            movedIndex,
            sourceId,
            movedTodo: movedIndex !== -1 ? next[movedIndex] : null,
            indent: movedIndex !== -1 ? next[movedIndex].indent : null,
          });
          // Find nearest previous ACTIVE top-level parent by parentId (not just indent)
          let parentId: number | null = null;

          // First, check if targetId itself is a valid parent (direct drop onto parent)
          // This handles the case where a child is dragged onto a parent
          if (targetIndex !== -1) {
            const targetTodo = next[targetIndex];
            if (
              targetTodo.parentId == null &&
              !targetTodo.completed &&
              targetIndex > movedIndex
            ) {
              // Target is an active top-level parent positioned after the moved child
              parentId = targetId;
            }
          }

          // Otherwise search backward for nearest active parent
          if (parentId == null) {
            for (let i = movedIndex - 1; i >= 0; i--) {
              const cand = next[i];
              if (cand.parentId == null && !cand.completed) {
                // Found a top-level active parent - use it as new parent
                parentId = cand.id;
                break;
              }
            }
          }
          debugLogger.log('info', 'Computed new parent for moved child', {
            sourceId,
            parentId,
          });
          if (parentId == null) {
            next[movedIndex] = {
              ...next[movedIndex],
              parentId: null,
              indent: 0,
            } as any;
          } else {
            next[movedIndex] = {
              ...next[movedIndex],
              parentId,
              indent: 1,
            } as any;
          }
        }
        return next;
      });
      handleDragEnd();
    },
    [getTodos, handleDragEnd, setTodos],
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
        // orphan fix for child-only moves and set parentId accordingly
        if (!srcIsParent) {
          const movedIndex = next.findIndex((t) => t.id === sourceId);
          if (movedIndex !== -1 && Number(next[movedIndex].indent ?? 0) === 1) {
            // Find nearest previous ACTIVE top-level parent by parentId (not just indent)
            let parentId: number | null = null;
            for (let i = movedIndex - 1; i >= 0; i--) {
              const cand = next[i];
              if (cand.parentId == null && !cand.completed) {
                // Found a top-level active parent - use it as new parent
                parentId = cand.id;
                break;
              }
            }
            if (parentId == null) {
              next[movedIndex] = {
                ...next[movedIndex],
                parentId: null,
                indent: 0,
              } as any;
            } else {
              next[movedIndex] = {
                ...next[movedIndex],
                parentId,
                indent: 1,
              } as any;
            }
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
