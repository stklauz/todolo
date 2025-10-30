import React from 'react';

const styles = require('./TodoRow.module.css');

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
      const indentClass =
        indentLevel > 0 ? (styles as any)[`indent${indentLevel}`] || '' : '';
      return (
        <div
          className={`${styles.row} ${isDropTarget ? styles.dropTarget : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragOver(e);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragLeave();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop();
          }}
        >
          <span
            title="Drag to reorder"
            data-testid="todo-indent"
            aria-label="Drag to reorder"
            className={`${styles.draggable} ${indentClass}`}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart(e);
            }}
            onDragEnd={(e) => {
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
