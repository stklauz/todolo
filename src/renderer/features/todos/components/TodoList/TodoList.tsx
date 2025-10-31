import React from 'react';
import { TodoRow } from '../TodoRow/TodoRow';
import type { Section, AppSettings } from '../../types';
import { useTodosActions } from '../../contexts';
import useDragReorder from '../../hooks/useDragReorder';
import useFilteredTodos from '../../hooks/useFilteredTodos';
import useTodoKeyboardHandlers from '../../hooks/useTodoKeyboardHandlers';
import { groupTodosBySection, computeSectionById } from '../../utils/todoUtils';

// import { debugLogger } from '../../../../utils/debug';

// Import audio file with fallback for tests
let popSound: string;
try {
  popSound = require('../../../../../../assets/sounds/bell.mp3');
} catch {
  popSound = 'mock-audio';
}
const styles = require('./TodoList.module.css');

type Props = {
  appSettings: AppSettings;
  setInputRef: (id: number, el: HTMLTextAreaElement | null) => void;
  focusTodo: (id: number) => void;
};

const TodoList = React.memo(function TodoList({
  appSettings,
  setInputRef,
  focusTodo,
}: Props) {
  const {
    updateTodo,
    toggleTodo,
    getSelectedTodos,
    setSelectedTodos,
    insertTodoBelow,
    removeTodoAt,
    changeIndent,
  } = useTodosActions();

  const allTodos = getSelectedTodos();

  const handleTodoKeyDown = useTodoKeyboardHandlers({
    allTodos,
    changeIndent,
    insertTodoBelow,
    removeTodoAt,
    focusTodo,
  });

  const { filteredTodos: todos, insertBelowAndFocus } = useFilteredTodos(
    allTodos,
    appSettings.hideCompletedItems,
    insertTodoBelow,
    removeTodoAt,
    setSelectedTodos,
    focusTodo,
  );

  const sectionOf = (id: number): Section => {
    return computeSectionById(id, todos);
  };

  const {
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
  } = useDragReorder(() => todos, setSelectedTodos, sectionOf);
  // Keep latest todos in a ref so cached handlers can access fresh data
  const todosRef = React.useRef(todos);
  React.useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const idToIndex = React.useMemo(() => {
    const m = new Map<number, number>();
    todos.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [todos]);

  // Use groupTodosBySection which uses parentId relationships, not indent scanning
  const derived = React.useMemo(() => {
    return groupTodosBySection(todos);
  }, [todos]);

  const isSingleActive = derived.active.length === 1;
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  React.useEffect(() => {
    try {
      const audio = new Audio(popSound);
      audio.preload = 'auto';
      audio.volume = 0.3; // Set a reasonable volume
      audioRef.current = audio;
    } catch {
      // console.warn('Failed to initialize audio:', error);
    }
  }, []);

  // Cache per-id handlers so TodoRow props remain stable across renders
  const dragStartByIdRef = React.useRef(
    new Map<number, (e: React.DragEvent) => void>(),
  );
  const dragOverByIdRef = React.useRef(
    new Map<number, (e: React.DragEvent) => void>(),
  );
  const dragLeaveByIdRef = React.useRef(new Map<number, () => void>());
  const dropOnByIdRef = React.useRef(new Map<number, () => void>());

  // Small wrapper to call changeIndent via parent prop without recreating closures
  // const _handleIndent = React.useCallback(
  //   (id: number, delta: number) => {
  //     changeIndent(id, delta);
  //   },
  //   [changeIndent],
  // );

  // Key handling is owned by the parent (TodoApp) to ensure operations
  // are computed against the full list, not the filtered view.

  const getDragStart = React.useCallback(
    (id: number) => {
      const ex = dragStartByIdRef.current.get(id);
      if (ex) return ex;
      const fn = (_e: React.DragEvent) => handleDragStart(id);
      dragStartByIdRef.current.set(id, fn);
      return fn;
    },
    [handleDragStart],
  );

  const getDragOver = React.useCallback(
    (id: number) => {
      const ex = dragOverByIdRef.current.get(id);
      if (ex) return ex;
      const fn = (e: React.DragEvent) => handleDragOver(e, id);
      dragOverByIdRef.current.set(id, fn);
      return fn;
    },
    [handleDragOver],
  );

  const getDragLeave = React.useCallback(
    (id: number) => {
      const ex = dragLeaveByIdRef.current.get(id);
      if (ex) return ex;
      const fn = () => handleDragLeave(id);
      dragLeaveByIdRef.current.set(id, fn);
      return fn;
    },
    [handleDragLeave],
  );

  const getDropOn = React.useCallback(
    (id: number) => {
      const ex = dropOnByIdRef.current.get(id);
      if (ex) return ex;
      const fn = () => handleDropOn(id);
      dropOnByIdRef.current.set(id, fn);
      return fn;
    },
    [handleDropOn],
  );

  return (
    <div className={styles.list}>
      <div data-testid="active-section">
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
                    audio.play().catch(() => {
                      // console.warn('Audio playback failed:', error);
                    });
                  } catch {
                    // console.warn('Audio error:', error);
                  }
                }

                const index = idToIndex.get(todo.id) ?? -1;
                toggleTodo(todo.id);
                // If this was the only active non-empty todo, create a new empty one and focus it
                if (isSingleActive && !isEmpty && index !== -1) {
                  insertBelowAndFocus(todo.id, '');
                }
              }}
              toggleDisabled={toggleDisabled}
              onChange={(e) => updateTodo(todo.id, e.target.value)}
              onKeyDown={handleTodoKeyDown(todo.id)}
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
          className={
            dropAtSectionEnd === 'active'
              ? `${styles.dropZone} ${styles.dropZoneActive}`
              : styles.dropZone
          }
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragOverEndZone(e, 'active');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragLeaveEndZone('active');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDropAtEnd('active');
          }}
        />
      </div>

      {derived.completed.length > 0 && (
        <div className={styles.sectionGroup}>
          <div className={styles.sectionDivider} />
        </div>
      )}

      <div data-testid="completed-section">
        {derived.completed.map((todo) => (
          <TodoRow
            key={todo.id}
            value={todo.text}
            checked={todo.completed}
            indent={todo.indent ?? 0}
            indeterminate={derived.indeterminate.get(todo.id) === true}
            onToggle={() => toggleTodo(todo.id)}
            onChange={(e) => updateTodo(todo.id, e.target.value)}
            onKeyDown={handleTodoKeyDown(todo.id)}
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
          className={
            dropAtSectionEnd === 'completed'
              ? `${styles.dropZone} ${styles.dropZoneActive}`
              : styles.dropZone
          }
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragOverEndZone(e, 'completed');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragLeaveEndZone('completed');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDropAtEnd('completed');
          }}
        />
      </div>
    </div>
  );
});

export default TodoList;
