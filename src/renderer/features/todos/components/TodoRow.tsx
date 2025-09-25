import React from 'react';
const styles = require('../styles/TodoList.module.css');

// Debug mode - set to true to enable detailed logging
const DEBUG_DRAG_DROP = true;

const debugLog = (message: string, data?: any) => {
  if (DEBUG_DRAG_DROP) {
    console.log(`[TodoRow Debug] ${message}`, data || '');
  }
};

type TodoRowProps = {
  value: string;
  checked: boolean;
  indent?: number;
  indeterminate?: boolean;
  onToggle: () => void;
  toggleDisabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDropTarget?: boolean;
};

export const TodoRow = React.memo(
  React.forwardRef<HTMLTextAreaElement, TodoRowProps>(
    (
      {
        value,
        checked,
        indent = 0,
        indeterminate = false,
        onToggle,
        toggleDisabled,
        onChange,
        onKeyDown,
        onDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onDragEnd,
        isDropTarget,
      },
      ref,
    ) => {
      const indentLevel = Math.max(0, Math.min(1, Number(indent)));
      const checkboxRef = React.useRef<HTMLInputElement | null>(null);
      React.useEffect(() => {
        if (checkboxRef.current) {
          checkboxRef.current.indeterminate = Boolean(indeterminate);
        }
      }, [indeterminate]);
      const indentClass = indentLevel > 0 ? (styles as any)[`indent${indentLevel}`] || '' : '';
      return (
        <div
          className={`${styles.row} ${indentClass} ${isDropTarget ? styles.dropTarget : ''}`}
          onDragOver={(e) => {
            debugLog('Row drag over', { value, isDropTarget, eventType: e.type });
            e.preventDefault();
            e.stopPropagation();
            onDragOver(e);
          }}
          onDragLeave={(e) => {
            debugLog('Row drag leave', { value, isDropTarget, eventType: e.type });
            e.preventDefault();
            e.stopPropagation();
            onDragLeave();
          }}
          onDrop={(e) => {
            debugLog('Row drop', { value, isDropTarget, eventType: e.type });
            e.preventDefault();
            e.stopPropagation();
            onDrop();
          }}
        >
          <span
            title="Drag to reorder"
            role="button"
            aria-label="Drag to reorder"
            className={styles.draggable}
            draggable
            onDragStart={(e) => {
              debugLog('Span drag start', { value, eventType: e.type });
              e.stopPropagation();
              onDragStart(e);
            }}
            onDragEnd={(e) => {
              debugLog('Span drag end', { value, eventType: e.type });
              e.stopPropagation();
              onDragEnd();
            }}
          >
            <input
              type="checkbox"
              aria-label="Toggle completed"
              checked={checked}
              onChange={onToggle}
              disabled={toggleDisabled}
              className={styles.checkbox}
              ref={checkboxRef}
            />
            <textarea
              aria-label="Todo text"
              value={value}
              onChange={onChange}
              onKeyDown={onKeyDown}
              ref={ref}
              placeholder="add your todo"
              className={`${styles.input} ${checked ? styles.inputCompleted : ''}`}
              rows={1}
            />
          </span>
        </div>
      );
    },
  ),
);

TodoRow.displayName = 'TodoRow';
