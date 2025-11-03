import React from 'react';
import type { AppSettings } from '../../types';
import { useTimeout } from '../../hooks/useTimeout';
import ActionsMenu from './components/ActionsMenu';
import { useTodosStore } from '../../store/useTodosStore';
import useListEditing from '../../hooks/useListEditing';

const styles = require('./TodoListHeader.module.css');

type TodoListHeaderProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (settings: AppSettings) => void;
};

export default function TodoListHeader({
  appSettings,
  onUpdateAppSettings,
}: TodoListHeaderProps): React.ReactElement {
  const lists = useTodosStore((s) => s.lists);
  const selectedListId = useTodosStore((s) => s.selectedListId);
  const {
    editingListId,
    editingName,
    inputJustFocusedRef,
    titleInputRef,
    startRename,
    setEditingName,
    commitRename,
    cancelRename,
  } = useListEditing();
  const selectedList = lists.find((l) => l.id === selectedListId) ?? null;
  const selectedListName = selectedList?.name ?? 'My List';
  const isEditing = editingListId === selectedList?.id;
  const displayValue = isEditing ? editingName : selectedListName;
  const setCleanupTimeout = useTimeout();

  const handleStartRename = () => {
    if (!isEditing) {
      const targetId = selectedList?.id ?? null;
      const currentName = selectedList?.name ?? 'My List';
      if (targetId) {
        startRename(targetId, currentName);
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

  const handleBlur = () => {
    // Don't commit if this is an immediate blur after focus
    if (inputJustFocusedRef.current) {
      return;
    }
    if (isEditing) {
      commitRename();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (isEditing) {
        commitRename();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (isEditing) {
        cancelRename();
      }
    }
  };

  return (
    <div className={styles.todoListHeader}>
      <div className={styles.titleRow}>
        <input
          ref={titleInputRef}
          className={`${styles.titleInput} ${isEditing ? styles.titleInputEditing : ''}`}
          value={displayValue}
          onChange={(e) => setEditingName(e.target.value)}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          readOnly={!isEditing}
          data-testid="heading"
        />
        {selectedList && (
          <ActionsMenu
            appSettings={appSettings}
            onUpdateAppSettings={onUpdateAppSettings}
          />
        )}
      </div>
      {selectedList && (
        <div className={styles.subtitleRow}>
          <div className={styles.subtitle}>
            {selectedList.createdAt && (
              <span>
                Created{' '}
                {new Date(selectedList.createdAt).toLocaleDateString()}{' '}
              </span>
            )}
            {selectedList.updatedAt && (
              <span>
                • Updated{' '}
                {new Date(selectedList.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
