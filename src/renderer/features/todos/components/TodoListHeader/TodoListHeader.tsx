import React from 'react';
import type { TodoList } from '../../types';
import { useTimeout } from '../../hooks/useTimeout';

const styles = require('./TodoListHeader.module.css');

type TodoListHeaderProps = {
  selectedList: TodoList | null;
  selectedListName: string;
  editingListId: string | null;
  editingName: string;
  inputJustFocusedRef: React.MutableRefObject<boolean>;
  titleInputRef: React.RefObject<HTMLInputElement | null>;
  onStartRename: (id: string, currentName: string) => void;
  onChangeName: (name: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  children: React.ReactNode; // ActionsRow component
};

export default function TodoListHeader({
  selectedList,
  selectedListName,
  editingListId,
  editingName,
  inputJustFocusedRef,
  titleInputRef,
  onStartRename,
  onChangeName,
  onCommitRename,
  onCancelRename,
  children,
}: TodoListHeaderProps): React.ReactElement {
  const isEditing = editingListId === selectedList?.id;
  const displayValue = isEditing ? editingName : selectedListName;
  const setCleanupTimeout = useTimeout();

  const handleStartRename = () => {
    if (!isEditing) {
      const targetId = selectedList?.id ?? null;
      const currentName = selectedList?.name ?? 'My List';
      if (targetId) {
        onStartRename(targetId, currentName);
      }
    }
  };

  const handleClick = () => {
    handleStartRename();
  };

  const handleFocus = () => {
    handleStartRename();

    inputJustFocusedRef.current = true;
    // Reset the flag after a short delay
    setCleanupTimeout(() => {
      inputJustFocusedRef.current = false;
    }, 150);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Don't commit if this is an immediate blur after focus
    if (inputJustFocusedRef.current) {
      return;
    }
    if (isEditing) {
      onCommitRename();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (isEditing) {
        onCommitRename();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (isEditing) {
        onCancelRename();
      }
    }
  };

  return (
    <div className={styles.titleRow}>
      <input
        ref={titleInputRef}
        className={`${styles.titleInput} ${isEditing ? styles.titleInputEditing : ''}`}
        value={displayValue}
        onChange={(e) => onChangeName(e.target.value)}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={!isEditing}
        data-testid="heading"
      />
      {children}
    </div>
  );
}
