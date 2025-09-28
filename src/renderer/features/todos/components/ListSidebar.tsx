import React from 'react';
import type { TodoList } from '../types';
import { IoAddOutline } from 'react-icons/io5';
import { ReactComponent as TodoloLogo } from '../../../../../assets/logo/todolo.svg';
const styles = require('../styles/Sidebar.module.css');

type Props = {
  lists: TodoList[];
  selectedListId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  // delete handled in title area; no per-item delete here
  // rename controls
  editingListId: string | null;
  editingName: string;
  onStartRename: (id: string, currentName: string) => void;
  onChangeName: (name: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
};

export default function ListSidebar({
  lists,
  selectedListId,
  onSelect,
  onAdd,
  editingListId,
  editingName,
  onStartRename,
  onChangeName,
  onCommitRename,
  onCancelRename,
}: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <TodoloLogo className={styles.logo} />
        <button type="button" onClick={onAdd} title="Add list" className={styles.iconBtn} aria-label="Add list">
          <IoAddOutline size={18} />
        </button>
      </div>
      <div className={styles.lists}>
        {lists.map((l) => (
          <div
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={`${styles.listItem} ${l.id === selectedListId ? styles.listItemActive : ''}`}
          >
            <span className={styles.listName} title={l.name}>{l.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
