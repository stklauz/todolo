import React from 'react';
import { TodoRow } from './TodoRow';

// Import audio file with fallback for tests
let popSound: string;
try {
  popSound = require('../../../../../assets/sounds/bell.mp3');
} catch {
  popSound = 'mock-audio';
}
const styles = require('../styles/TodoList.module.css');
import type { EditorTodo } from '../types';

// Debug mode - set to true to enable detailed logging
const DEBUG_DRAG_DROP = true;

const debugLog = (message: string, data?: any) => {
  if (DEBUG_DRAG_DROP) {
    console.log(`[TodoList Debug] ${message}`, data || '');
  }
};

type Props = {
  todos: EditorTodo[];
  updateTodo: (id: number, text: string) => void;
  toggleTodo: (id: number) => void;
  handleTodoKeyDown: (id: number) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  insertBelowAndFocus: (index: number, text?: string) => void;
  changeIndent: (id: number, delta: number) => void;
  removeAt: (index: number) => void;
  // drag & drop
  dragInfo: { id: number; section: 'active' | 'completed' } | null;
  handleDragStart: (id: number) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: React.DragEvent, targetId: number) => void;
  handleDragLeave: (targetId: number) => void;
  handleDropOn: (targetId: number) => void;
  dropTargetId: number | null;
  dropAtSectionEnd: 'active' | 'completed' | null;
  handleDragOverEndZone: (e: React.DragEvent, section: 'active' | 'completed') => void;
  handleDragLeaveEndZone: (section: 'active' | 'completed') => void;
  handleDropAtEnd: (section: 'active' | 'completed') => void;
  setInputRef: (id: number, el: HTMLTextAreaElement | null) => void;
};

export default function TodoList({
  todos,
  updateTodo,
  toggleTodo,
  handleTodoKeyDown,
  insertBelowAndFocus,
  changeIndent,
  removeAt,
  dragInfo,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDropOn,
  dropTargetId,
  dropAtSectionEnd,
  handleDragOverEndZone,
  handleDragLeaveEndZone,
  handleDropAtEnd,
  setInputRef,
}: Props) {
  // Keep latest todos in a ref so cached handlers can access fresh data
  const todosRef = React.useRef(todos);
  React.useEffect(() => { todosRef.current = todos; }, [todos]);

  const idToIndex = React.useMemo(() => {
    const m = new Map<number, number>();
    todos.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [todos]);

  const derived = React.useMemo(() => {
    const indeterminate = new Map<number, boolean>();
    const section = new Map<number, 'active' | 'completed'>();
    for (let i = 0; i < todos.length; i++) {
      const t = todos[i];
      const indent = Number(t.indent ?? 0);
      if (indent <= 0) {
        // parent: compute indeterminate and effective completion
        let hasChild = false;
        let allChildrenCompleted = true;
        let anyChildCompleted = false;
        for (let j = i + 1; j < todos.length; j++) {
          if (Number(todos[j].indent ?? 0) === 0) break;
          hasChild = true;
          if (todos[j].completed) anyChildCompleted = true;
          if (!todos[j].completed) allChildrenCompleted = false;
        }
        const effCompleted = t.completed && (!hasChild || allChildrenCompleted);
        section.set(t.id, effCompleted ? 'completed' : 'active');
        indeterminate.set(t.id, hasChild && anyChildCompleted && !allChildrenCompleted);
      } else {
        // child: completed only if child and nearest parent are completed
        let parentCompleted = false;
        for (let j = i - 1; j >= 0; j--) {
          if (Number(todos[j].indent ?? 0) === 0) { parentCompleted = !!todos[j].completed; break; }
        }
        section.set(t.id, t.completed && parentCompleted ? 'completed' : 'active');
        indeterminate.set(t.id, false);
      }
    }
    const active: EditorTodo[] = [];
    const completed: EditorTodo[] = [];
    todos.forEach((t) => (section.get(t.id) === 'completed' ? completed.push(t) : active.push(t)));
    return { indeterminate, section, active, completed } as const;
  }, [todos]);

  const isSingleActive = derived.active.length === 1;
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  React.useEffect(() => {
    try {
      const audio = new Audio(popSound);
      audio.preload = 'auto';
      audio.volume = 0.3; // Set a reasonable volume
      audioRef.current = audio;
    } catch (error) {
      console.warn('Failed to initialize audio:', error);
    }
  }, []);

  // Cache per-id handlers so TodoRow props remain stable across renders
  const keydownByIdRef = React.useRef(new Map<number, (e: React.KeyboardEvent<HTMLTextAreaElement>) => void>());
  const dragStartByIdRef = React.useRef(new Map<number, (e: React.DragEvent) => void>());
  const dragOverByIdRef = React.useRef(new Map<number, (e: React.DragEvent) => void>());
  const dragLeaveByIdRef = React.useRef(new Map<number, () => void>());
  const dropOnByIdRef = React.useRef(new Map<number, () => void>());

  // Small wrapper to call changeIndent via parent prop without recreating closures
  const handleIndent = React.useCallback((id: number, delta: number) => {
    changeIndent(id, delta);
  }, [changeIndent]);

  const getKeydownHandler = React.useCallback((id: number) => {
    const existing = keydownByIdRef.current.get(id);
    if (existing) return existing;
    const fn = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const list = todosRef.current;
      const idx = list.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const cur = list[idx];
      if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
          // outdent
          handleIndent(id, -1);
        } else {
          // only indent if there is a parent above
          let hasParent = false;
          for (let i = idx - 1; i >= 0; i--) {
            if ((Number(list[i].indent ?? 0)) === 0) { hasParent = true; break; }
          }
          if (hasParent) handleIndent(id, +1);
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (cur && cur.text.trim().length > 0) {
          insertBelowAndFocus(idx);
        }
        return;
      }
      if (event.key === 'Backspace') {
        const isEmpty = !cur || cur.text.length === 0;
        if (isEmpty) {
          event.preventDefault();
          const indent = Number(cur?.indent ?? 0);
          if (indent > 0) {
            handleIndent(id, -1);
            return;
          }
          if (list.length <= 1) return;
          removeAt(idx);
        }
      }
    };
    keydownByIdRef.current.set(id, fn);
    return fn;
  }, [handleIndent, insertBelowAndFocus, removeAt]);

  const getDragStart = React.useCallback((id: number) => {
    const ex = dragStartByIdRef.current.get(id);
    if (ex) return ex;
    const fn = (_e: React.DragEvent) => handleDragStart(id);
    dragStartByIdRef.current.set(id, fn);
    return fn;
  }, [handleDragStart]);

  const getDragOver = React.useCallback((id: number) => {
    const ex = dragOverByIdRef.current.get(id);
    if (ex) return ex;
    const fn = (e: React.DragEvent) => handleDragOver(e, id);
    dragOverByIdRef.current.set(id, fn);
    return fn;
  }, [handleDragOver]);

  const getDragLeave = React.useCallback((id: number) => {
    const ex = dragLeaveByIdRef.current.get(id);
    if (ex) return ex;
    const fn = () => handleDragLeave(id);
    dragLeaveByIdRef.current.set(id, fn);
    return fn;
  }, [handleDragLeave]);

  const getDropOn = React.useCallback((id: number) => {
    const ex = dropOnByIdRef.current.get(id);
    if (ex) return ex;
    const fn = () => handleDropOn(id);
    dropOnByIdRef.current.set(id, fn);
    return fn;
  }, [handleDropOn]);

  return (
    <>
      {derived.active.map((todo) => {
        const isEmpty = todo.text.trim().length === 0;
        const toggleDisabled = isEmpty;
        return (
        <TodoRow
          key={todo.id}
          value={todo.text}
          checked={todo.completed}
          indent={todo.indent ?? 0}
          indeterminate={derived.indeterminate.get(todo.id) === true}
          onToggle={() => {
            if (toggleDisabled) return;
            
            // Play audio with better error handling
            const audio = audioRef.current;
            if (audio) {
              try {
                audio.currentTime = 0;
                audio.play().catch((error) => {
                  console.warn('Audio playback failed:', error);
                });
              } catch (error) {
                console.warn('Audio error:', error);
              }
            }
            
            const index = idToIndex.get(todo.id) ?? -1;
            toggleTodo(todo.id);
            // If this was the only active non-empty todo, create a new empty one and focus it
            if (isSingleActive && !isEmpty && index !== -1) {
              insertBelowAndFocus(index, '');
            }
          }}
          toggleDisabled={toggleDisabled}
          onChange={(e) => updateTodo(todo.id, e.target.value)}
          onKeyDown={getKeydownHandler(todo.id)}
          onDragStart={getDragStart(todo.id)}
          onDragEnd={handleDragEnd}
          onDragOver={getDragOver(todo.id)}
          onDragLeave={getDragLeave(todo.id)}
          onDrop={getDropOn(todo.id)}
          isDropTarget={dropTargetId === todo.id}
          ref={(el) => setInputRef(todo.id, el)}
        />
        );
      })}

      {/* End drop zone for Active section */}
      <div
        className={dropAtSectionEnd === 'active' ? `${styles.dropZone} ${styles.dropZoneActive}` : styles.dropZone}
        onDragOver={(e) => {
          debugLog('Active end zone drag over', { eventType: e.type, dropAtSectionEnd });
          e.preventDefault();
          e.stopPropagation();
          handleDragOverEndZone(e, 'active');
        }}
        onDragLeave={(e) => {
          debugLog('Active end zone drag leave', { eventType: e.type, dropAtSectionEnd });
          e.preventDefault();
          e.stopPropagation();
          handleDragLeaveEndZone('active');
        }}
        onDrop={(e) => {
          debugLog('Active end zone drop', { eventType: e.type, dropAtSectionEnd });
          e.preventDefault();
          e.stopPropagation();
          handleDropAtEnd('active');
        }}
      />

      {derived.completed.length > 0 && (
        <div className={styles.sectionGroup}>
          <div className={styles.sectionDivider} />
        </div>
      )}

      {derived.completed.map((todo) => (
        <TodoRow
          key={todo.id}
          value={todo.text}
          checked={todo.completed}
          indent={todo.indent ?? 0}
          indeterminate={derived.indeterminate.get(todo.id) === true}
          onToggle={() => toggleTodo(todo.id)}
          onChange={(e) => updateTodo(todo.id, e.target.value)}
          onKeyDown={getKeydownHandler(todo.id)}
          onDragStart={getDragStart(todo.id)}
          onDragEnd={handleDragEnd}
          onDragOver={getDragOver(todo.id)}
          onDragLeave={getDragLeave(todo.id)}
          onDrop={getDropOn(todo.id)}
          isDropTarget={dropTargetId === todo.id}
          ref={(el) => setInputRef(todo.id, el)}
        />
      ))}

      {/* End drop zone for Completed section (bottom of list) */}
      <div
        className={dropAtSectionEnd === 'completed' ? `${styles.dropZone} ${styles.dropZoneActive}` : styles.dropZone}
        onDragOver={(e) => {
          debugLog('Completed end zone drag over', { eventType: e.type, dropAtSectionEnd });
          e.preventDefault();
          e.stopPropagation();
          handleDragOverEndZone(e, 'completed');
        }}
        onDragLeave={(e) => {
          debugLog('Completed end zone drag leave', { eventType: e.type, dropAtSectionEnd });
          e.preventDefault();
          e.stopPropagation();
          handleDragLeaveEndZone('completed');
        }}
        onDrop={(e) => {
          debugLog('Completed end zone drop', { eventType: e.type, dropAtSectionEnd });
          e.preventDefault();
          e.stopPropagation();
          handleDropAtEnd('completed');
        }}
      />
    </>
  );
}
