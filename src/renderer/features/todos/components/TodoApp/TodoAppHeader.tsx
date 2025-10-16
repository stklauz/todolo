import React from 'react';
import type { TodoList } from '../../types';

const styles = require('./TodoApp.module.css');

type TodoAppHeaderProps = {
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

export default function TodoAppHeader({
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
}: TodoAppHeaderProps): React.ReactElement {
  return (
    <div className={styles.titleRow}>
      {editingListId === selectedList?.id ? (
        <input
          ref={titleInputRef}
          className={styles.titleInput}
          value={editingName}
          onChange={(e) => onChangeName(e.target.value)}
          onFocus={() => {
            inputJustFocusedRef.current = true;
            // Reset the flag after a short delay
            setTimeout(() => {
              inputJustFocusedRef.current = false;
            }, 150);
          }}
          onBlur={(e) => {
            // Don't commit if this is an immediate blur after focus
            if (inputJustFocusedRef.current) {
              return;
            }
            // Only commit if we're actually losing focus to something else
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (relatedTarget && relatedTarget.closest('.titleRow')) {
              // If focus is moving to another element in the title row, don't commit
              return;
            }
            onCommitRename();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              onCommitRename();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancelRename();
            }
          }}
        />
      ) : (
        <h1
          className={`${styles.title} ${styles.titleClickable}`}
          onClick={() => {
            const targetId = selectedList?.id ?? null;
            const currentName = selectedList?.name ?? 'My List';
            if (targetId) {
              onStartRename(targetId, currentName);
            }
          }}
          title="Click to rename"
        >
          {selectedListName}
        </h1>
      )}
      {children}
    </div>
  );
}
