import React from 'react';
import type { EditorTodo, Section } from '../types';

type GetTodos = () => EditorTodo[];
type SetTodos = (updater: (prev: EditorTodo[]) => EditorTodo[]) => void;

// Debug mode: set to true to enable detailed logging
const DEBUG_DRAG_DROP = true;

const debugLog = (message: string, data?: any) => {
  if (DEBUG_DRAG_DROP) {
    console.log(`[DragDrop Debug] ${message}`, data || '');
  }
};

export default function useDragReorder(
  getTodos: GetTodos,
  setTodos: SetTodos,
  sectionOf: (id: number) => Section,
) {
  const [dragInfo, setDragInfo] = React.useState<{ id: number; section: Section } | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<number | null>(null);
  const [dropAtSectionEnd, setDropAtSectionEnd] = React.useState<Section | null>(null);
  
  // Use a ref to store the current drag info so it's always accessible in callbacks
  const dragInfoRef = React.useRef<{ id: number; section: Section } | null>(null);
  
  // Keep the ref in sync with the state
  React.useEffect(() => {
    dragInfoRef.current = dragInfo;
  }, [dragInfo]);

  // Simple helper function to check if targetId is a child of sourceId
  const isChildOf = React.useCallback((sourceId: number, targetId: number): boolean => {
    const todos = getTodos();
    const sourceIndex = todos.findIndex(t => t.id === sourceId);
    const targetIndex = todos.findIndex(t => t.id === targetId);
    
    debugLog('isChildOf check', { 
      sourceId, targetId, sourceIndex, targetIndex,
      allTodos: todos.map(t => ({ id: t.id, text: t.text, indent: t.indent, completed: t.completed }))
    });
    
    if (sourceIndex === -1 || targetIndex === -1) return false;
    
    const sourceTodo = todos[sourceIndex];
    const targetTodo = todos[targetIndex];
    
    if (!sourceTodo || !targetTodo) return false;
    
    // Must be in same section
    if (sourceTodo.completed !== targetTodo.completed) return false;
    
    // Target must come after source
    if (targetIndex <= sourceIndex) return false;
    
    const sourceIndent = sourceTodo.indent ?? 0;
    const targetIndent = targetTodo.indent ?? 0;
    
    // Target must be indented more than source
    if (targetIndent <= sourceIndent) return false;
    
    // Check if there's any todo between source and target that breaks the relationship
    for (let i = sourceIndex + 1; i < targetIndex; i++) {
      const todo = todos[i];
      if (todo && (todo.indent ?? 0) <= sourceIndent) {
        debugLog('isChildOf: intermediate todo breaks relationship', { 
          intermediateIndex: i, 
          intermediateIndent: todo.indent ?? 0, 
          sourceIndent 
        });
        return false;
      }
    }
    
    debugLog('isChildOf: TRUE - target is child of source', { sourceId, targetId });
    return true;
  }, [getTodos]);

  const handleDragStart = React.useCallback((id: number) => {
    const section = sectionOf(id);
    debugLog('Drag start', { id, section, allTodos: getTodos().map(t => ({ id: t.id, text: t.text, completed: t.completed, indent: t.indent })) });
    setDragInfo({ id, section });
    setDropTargetId(null);
    setDropAtSectionEnd(null);
  }, [sectionOf, getTodos]);

  const handleDragEnd = React.useCallback(() => {
    debugLog('Drag end', { dragInfo });
    setDragInfo(null);
    setDropTargetId(null);
    setDropAtSectionEnd(null);
  }, []);

  const handleDragOver = React.useCallback((event: React.DragEvent, targetId: number) => {
    event.preventDefault();
    const currentDragInfo = dragInfoRef.current;
    debugLog('Drag over', { targetId, dragInfo: currentDragInfo, eventType: event.type });
    if (!currentDragInfo) {
      debugLog('No drag info, ignoring drag over');
      return;
    }
    if (targetId === currentDragInfo.id) {
      debugLog('Target is same as source, clearing drop target');
      setDropTargetId(null);
      return;
    }
    const targetSection = sectionOf(targetId);
    if (targetSection !== currentDragInfo.section) {
      debugLog('Sections do not match', { sourceSection: currentDragInfo.section, targetSection });
      setDropTargetId(null);
      return;
    }
    
    // Check if trying to drop parent under its child - prevent this
    if (isChildOf(currentDragInfo.id, targetId)) {
      debugLog('Cannot drop parent under child', { sourceId: currentDragInfo.id, targetId });
      setDropTargetId(null);
      return;
    }
    
    debugLog('Valid drop target', { targetId, section: targetSection });
    setDropTargetId(targetId);
    setDropAtSectionEnd(null);
  }, [sectionOf, isChildOf]);

  const handleDragLeave = React.useCallback((targetId: number) => {
    debugLog('Drag leave', { targetId, currentDropTarget: dropTargetId });
    setDropTargetId((prev) => (prev === targetId ? null : prev));
  }, []);

  const handleDropOn = React.useCallback((targetId: number) => {
    const currentDragInfo = dragInfoRef.current;
    debugLog('Drop on', { targetId, dragInfo: currentDragInfo });
    if (!currentDragInfo) {
      debugLog('No drag info, ignoring drop');
      return;
    }
    const sourceId = currentDragInfo.id;
    const targetSection = sectionOf(targetId);
    if (targetSection !== currentDragInfo.section) {
      debugLog('Sections do not match, ignoring drop', { sourceSection: currentDragInfo.section, targetSection });
      return handleDragEnd();
    }
    if (sourceId === targetId) {
      debugLog('Source and target are the same, ignoring drop');
      return handleDragEnd();
    }
    
    // Check if trying to drop parent under its child - prevent this
    if (isChildOf(sourceId, targetId)) {
      debugLog('Cannot drop parent under child, ignoring drop', { sourceId, targetId });
      return handleDragEnd();
    }
    
    debugLog('Processing normal drop', { sourceId, targetId, sourceSection: currentDragInfo.section, targetSection });
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
  }, [handleDragEnd, sectionOf, setTodos, isChildOf]);

  const handleDragOverEndZone = React.useCallback((event: React.DragEvent, section: Section) => {
    event.preventDefault();
    const currentDragInfo = dragInfoRef.current;
    debugLog('Drag over end zone', { section, dragInfo: currentDragInfo });
    if (!currentDragInfo || currentDragInfo.section !== section) {
      debugLog('Invalid end zone drag over', { section, dragInfo: currentDragInfo });
      setDropAtSectionEnd(null);
      return;
    }
    debugLog('Valid end zone drag over', { section });
    setDropTargetId(null);
    setDropAtSectionEnd(section);
  }, []);

  const handleDragLeaveEndZone = React.useCallback((section: Section) => {
    debugLog('Drag leave end zone', { section, currentDropAtSectionEnd: dropAtSectionEnd });
    setDropAtSectionEnd((prev) => (prev === section ? null : prev));
  }, []);

  const handleDropAtEnd = React.useCallback((section: Section) => {
    const currentDragInfo = dragInfoRef.current;
    debugLog('Drop at end', { section, dragInfo: currentDragInfo });
    if (!currentDragInfo || currentDragInfo.section !== section) {
      debugLog('Invalid drop at end', { section, dragInfo: currentDragInfo });
      return;
    }
    const sourceId = currentDragInfo.id;
    debugLog('Processing drop at end', { sourceId, section });
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
  }, [handleDragEnd, setTodos]);

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
