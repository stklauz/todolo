import React from 'react';
import { IoAddOutline } from 'react-icons/io5';
import type { TodoList } from '../../types';
import { ReactComponent as TodoloLogo } from '../../../../../../assets/logo/todolo.svg';

const styles = require('./Sidebar.module.css');

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
  // focus management
  focusListId?: string | null;
};

export default function ListSidebar({
  lists,
  selectedListId,
  onSelect,
  onAdd,
  editingListId: _editingListId,
  editingName: _editingName,
  onStartRename: _onStartRename,
  onChangeName: _onChangeName,
  onCommitRename: _onCommitRename,
  onCancelRename: _onCancelRename,
  focusListId,
}: Props) {
  const listItemRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // Focus management effect
  React.useEffect(() => {
    if (focusListId) {
      const element = listItemRefs.current.get(focusListId);
      if (element) {
        // Scroll into view first (if available)
        if (typeof element.scrollIntoView === 'function') {
          element.scrollIntoView({ block: 'nearest' });
        }
        // Then focus
        element.focus();
      }
    }
  }, [focusListId]);

  const setListItemRef = (id: string, element: HTMLDivElement | null) => {
    if (element) {
      listItemRefs.current.set(id, element);
    } else {
      listItemRefs.current.delete(id);
    }
  };
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <TodoloLogo className={styles.logo} />
        <button
          type="button"
          onClick={onAdd}
          title="Add list"
          className={styles.iconBtn}
          aria-label="Add list"
        >
          <IoAddOutline size={18} />
        </button>
      </div>
      <div className={styles.lists}>
        {lists.map((l) => (
          <div
            key={l.id}
            ref={(el) => setListItemRef(l.id, el)}
            tabIndex={0}
            role="button"
            onClick={() => onSelect(l.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(l.id);
              }
            }}
            className={`${styles.listItem} ${l.id === selectedListId ? styles.listItemActive : ''}`}
          >
            <span className={styles.listName} title={l.name}>
              {l.name}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
