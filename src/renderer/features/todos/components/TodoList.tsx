import React from 'react';
import popSound from '../../../../../assets/sounds/bell.wav';
import { TodoRow } from './TodoRow';
const styles = require('../styles/TodoList.module.css');
import type { EditorTodo } from '../types';

type Props = {
  todos: EditorTodo[];
  updateTodo: (id: number, text: string) => void;
  toggleTodo: (id: number) => void;
  handleTodoKeyDown: (id: number) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  insertBelowAndFocus: (index: number, text?: string) => void;
  // drag & drop
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
  const isParentIndeterminate = (idx: number): boolean => {
    const t = todos[idx];
    if (!t || Number(t.indent ?? 0) !== 0) return false;
    let hasChild = false;
    let completedChildren = 0;
    let totalChildren = 0;
    for (let i = idx + 1; i < todos.length; i++) {
      if (Number(todos[i].indent ?? 0) === 0) break;
      hasChild = true;
      totalChildren += 1;
      if (todos[i].completed) completedChildren += 1;
    }
    if (!hasChild) return false;
    return completedChildren > 0 && completedChildren < totalChildren;
  };

  const isEffectivelyCompleted = (idx: number): boolean => {
    const t = todos[idx];
    if (!t) return false;
    const indent = Number(t.indent ?? 0);
    if (indent <= 0) {
      if (!t.completed) return false;
      for (let i = idx + 1; i < todos.length; i++) {
        if (Number(todos[i].indent ?? 0) === 0) break;
        if (!todos[i].completed) return false;
      }
      return true;
    }
    let parentCompleted = false;
    for (let i = idx - 1; i >= 0; i--) {
      if (Number(todos[i].indent ?? 0) === 0) {
        parentCompleted = !!todos[i].completed;
        break;
      }
    }
    return !!t.completed && parentCompleted;
  };

  const activeTodos = todos.filter((_, i) => !isEffectivelyCompleted(i));
  const completedTodos = todos.filter((_, i) => isEffectivelyCompleted(i));
  const isSingleActive = activeTodos.length === 1;

  return (
    <>
      {activeTodos.map((todo) => {
        const isEmpty = todo.text.trim().length === 0;
        const toggleDisabled = isEmpty;
        return (
        <TodoRow
          key={todo.id}
          value={todo.text}
          checked={todo.completed}
          indent={todo.indent ?? 0}
          indeterminate={isParentIndeterminate(todos.findIndex((t) => t.id === todo.id))}
          onToggle={() => {
            if (toggleDisabled) return;
            try {
              // Play pop sound when checking a todo as completed
              const audio = new Audio(popSound);
              audio.play().catch(() => {});
            } catch (_) {
              // no-op if audio cannot play
            }
            const index = todos.findIndex((t) => t.id === todo.id);
            toggleTodo(todo.id);
            // If this was the only active non-empty todo, create a new empty one and focus it
            if (isSingleActive && !isEmpty && index !== -1) {
              insertBelowAndFocus(index, '');
            }
          }}
          toggleDisabled={toggleDisabled}
          onChange={(e) => updateTodo(todo.id, e.target.value)}
          onKeyDown={handleTodoKeyDown(todo.id)}
          onDragStart={() => handleDragStart(todo.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, todo.id)}
          onDragLeave={() => handleDragLeave(todo.id)}
          onDrop={() => handleDropOn(todo.id)}
          isDropTarget={dropTargetId === todo.id}
          ref={(el) => setInputRef(todo.id, el)}
        />
        );
      })}

      {/* End drop zone for Active section */}
      <div
        className={dropAtSectionEnd === 'active' ? `${styles.dropZone} ${styles.dropZoneActive}` : styles.dropZone}
        onDragOver={(e) => handleDragOverEndZone(e, 'active')}
        onDragLeave={() => handleDragLeaveEndZone('active')}
        onDrop={() => handleDropAtEnd('active')}
      />

      {completedTodos.length > 0 && (
        <div className={styles.sectionGroup}>
          <div className={styles.sectionDivider} />
        </div>
      )}

      {completedTodos.map((todo) => (
        <TodoRow
          key={todo.id}
          value={todo.text}
          checked={todo.completed}
          indent={todo.indent ?? 0}
          indeterminate={isParentIndeterminate(todos.findIndex((t) => t.id === todo.id))}
          onToggle={() => toggleTodo(todo.id)}
          onChange={(e) => updateTodo(todo.id, e.target.value)}
          onKeyDown={handleTodoKeyDown(todo.id)}
          onDragStart={() => handleDragStart(todo.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, todo.id)}
          onDragLeave={() => handleDragLeave(todo.id)}
          onDrop={() => handleDropOn(todo.id)}
          isDropTarget={dropTargetId === todo.id}
          ref={(el) => setInputRef(todo.id, el)}
        />
      ))}

      {/* End drop zone for Completed section (bottom of list) */}
      <div
        className={dropAtSectionEnd === 'completed' ? `${styles.dropZone} ${styles.dropZoneActive}` : styles.dropZone}
        onDragOver={(e) => handleDragOverEndZone(e, 'completed')}
        onDragLeave={() => handleDragLeaveEndZone('completed')}
        onDrop={() => handleDropAtEnd('completed')}
      />
    </>
  );
}
