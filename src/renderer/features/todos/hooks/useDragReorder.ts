import React from 'react';
import type { EditorTodo, Section } from '../types';

type GetTodos = () => EditorTodo[];
type SetTodos = (updater: (prev: EditorTodo[]) => EditorTodo[]) => void;

export default function useDragReorder(
  getTodos: GetTodos,
  setTodos: SetTodos,
  sectionOf: (id: number) => Section,
) {
  const [dragInfo, setDragInfo] = React.useState<{ id: number; section: Section } | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<number | null>(null);
  const [dropAtSectionEnd, setDropAtSectionEnd] = React.useState<Section | null>(null);

  const handleDragStart = React.useCallback((id: number) => {
    setDragInfo({ id, section: sectionOf(id) });
    setDropTargetId(null);
    setDropAtSectionEnd(null);
  }, [sectionOf]);

  const handleDragEnd = React.useCallback(() => {
    setDragInfo(null);
    setDropTargetId(null);
    setDropAtSectionEnd(null);
  }, []);

  const handleDragOver = React.useCallback((event: React.DragEvent, targetId: number) => {
    event.preventDefault();
    if (!dragInfo) return;
    if (targetId === dragInfo.id) {
      setDropTargetId(null);
      return;
    }
    if (sectionOf(targetId) !== dragInfo.section) {
      setDropTargetId(null);
      return;
    }
    setDropTargetId(targetId);
    setDropAtSectionEnd(null);
  }, [dragInfo, sectionOf]);

  const handleDragLeave = React.useCallback((targetId: number) => {
    setDropTargetId((prev) => (prev === targetId ? null : prev));
  }, []);

  const handleDropOn = React.useCallback((targetId: number) => {
    if (!dragInfo) return;
    const sourceId = dragInfo.id;
    if (sectionOf(targetId) !== dragInfo.section) return handleDragEnd();
    if (sourceId === targetId) return handleDragEnd();
    setTodos((prev) => {
      const computeSection = (list: EditorTodo[], id: number): Section => {
        const idx = list.findIndex((t) => t.id === id);
        if (idx === -1) return 'active';
        const cur = list[idx];
        const indent = Number(cur.indent ?? 0);
        if (indent <= 0) {
          if (!cur.completed) return 'active';
          for (let i = idx + 1; i < list.length; i++) {
            if (Number(list[i].indent ?? 0) === 0) break;
            if (!list[i].completed) return 'active';
          }
          return 'completed';
        }
        let parentCompleted = false;
        for (let i = idx - 1; i >= 0; i--) {
          if (Number(list[i].indent ?? 0) === 0) {
            parentCompleted = !!list[i].completed;
            break;
          }
        }
        return cur.completed && parentCompleted ? 'completed' : 'active';
      };
      const srcIndex0 = prev.findIndex((t) => t.id === sourceId);
      const tgtIndex0 = prev.findIndex((t) => t.id === targetId);
      if (srcIndex0 === -1 || tgtIndex0 === -1) return prev;
      if (computeSection(prev, sourceId) !== computeSection(prev, targetId)) return prev;
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
      let tgtIndex = tgtIndex0;
      if (Number(next[tgtIndex]?.indent ?? 0) === 1) {
        for (let i = tgtIndex; i >= 0; i--) {
          if (Number(next[i].indent ?? 0) === 0) { tgtIndex = i; break; }
        }
      }
      // adjust target index after removal
      if (tgtIndex0 > srcEnd) {
        // after removal, indices shift left by block length if target was after source block
        tgtIndex -= block.length;
      }
      // insert before target block start
      next.splice(tgtIndex, 0, ...block);
      // Ensure no orphan children for child moves: if item is child and no parent above, outdent
      // (applies if source wasn't a parent)
      if (!srcIsParent) {
        const movedIndex = next.findIndex((t) => t.id === sourceId);
        if (movedIndex !== -1 && Number(next[movedIndex].indent ?? 0) === 1) {
          let hasParent = false;
          for (let i = movedIndex - 1; i >= 0; i--) {
            if (Number(next[i].indent ?? 0) === 0) { hasParent = true; break; }
          }
          if (!hasParent) next[movedIndex] = { ...next[movedIndex], indent: 0 };
        }
      }
      return next;
    });
    handleDragEnd();
  }, [dragInfo, handleDragEnd, sectionOf, setTodos]);

  const handleDragOverEndZone = React.useCallback((event: React.DragEvent, section: Section) => {
    event.preventDefault();
    if (!dragInfo || dragInfo.section !== section) {
      setDropAtSectionEnd(null);
      return;
    }
    setDropTargetId(null);
    setDropAtSectionEnd(section);
  }, [dragInfo]);

  const handleDragLeaveEndZone = React.useCallback((section: Section) => {
    setDropAtSectionEnd((prev) => (prev === section ? null : prev));
  }, []);

  const handleDropAtEnd = React.useCallback((section: Section) => {
    if (!dragInfo || dragInfo.section !== section) return;
    const sourceId = dragInfo.id;
    setTodos((prev) => {
      const computeSection = (list: EditorTodo[], id: number): Section => {
        const idx = list.findIndex((t) => t.id === id);
        if (idx === -1) return 'active';
        const cur = list[idx];
        const indent = Number(cur.indent ?? 0);
        if (indent <= 0) {
          if (!cur.completed) return 'active';
          for (let i = idx + 1; i < list.length; i++) {
            if (Number(list[i].indent ?? 0) === 0) break;
            if (!list[i].completed) return 'active';
          }
          return 'completed';
        }
        let parentCompleted = false;
        for (let i = idx - 1; i >= 0; i--) {
          if (Number(list[i].indent ?? 0) === 0) {
            parentCompleted = !!list[i].completed;
            break;
          }
        }
        return cur.completed && parentCompleted ? 'completed' : 'active';
      };
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
        if (computeSection(next, next[i].id) === section) { lastIdx = i; break; }
      }
      next.splice(lastIdx + 1, 0, ...block);
      // orphan fix for child-only moves
      if (!srcIsParent) {
        const movedIndex = next.findIndex((t) => t.id === sourceId);
        if (movedIndex !== -1 && Number(next[movedIndex].indent ?? 0) === 1) {
          let hasParent = false;
          for (let i = movedIndex - 1; i >= 0; i--) {
            if (Number(next[i].indent ?? 0) === 0) { hasParent = true; break; }
          }
          if (!hasParent) next[movedIndex] = { ...next[movedIndex], indent: 0 };
        }
      }
      return next;
    });
    handleDragEnd();
  }, [dragInfo, handleDragEnd, setTodos]);

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
