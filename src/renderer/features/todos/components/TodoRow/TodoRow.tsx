import React from 'react';
import { Checkbox } from '../Checkbox';
import { clampIndent } from '../../utils/todoUtils';

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
      const indentLevel = clampIndent(Number(indent ?? 0));
      const maxClassDepth = 4;
      const classDepth = Math.min(indentLevel, maxClassDepth);
      const indentClass =
        classDepth > 0 ? (styles as any)[`indent${classDepth}`] || '' : '';
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
            <Checkbox
              checked={checked}
              indeterminate={indeterminate}
              disabled={toggleDisabled}
              onToggle={onToggle}
              ariaLabel="Toggle completed"
              spacing="sm"
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
