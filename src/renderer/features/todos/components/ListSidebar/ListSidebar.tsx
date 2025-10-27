import React from 'react';
import { IoAddOutline } from 'react-icons/io5';
import { ReactComponent as TodoloLogo } from '../../../../../../assets/logo/todolo.svg';
import { useTodosContext, useTodosActions } from '../../contexts';
import useListDuplication from '../../hooks/useListDuplication';
import useListEditing from '../../hooks/useListEditing';

const styles = require('./Sidebar.module.css');

export default function ListSidebar() {
  const { lists, selectedListId } = useTodosContext();
  const { setSelectedListId, addList } = useTodosActions();
  const { focusListId } = useListDuplication();
  const { startRename } = useListEditing();

  const handleAddList = React.useCallback(() => {
    const id = addList();
    startRename(id, `List ${lists.length + 1}`);
  }, [addList, startRename, lists.length]);
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
          onClick={handleAddList}
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
            onClick={() => setSelectedListId(l.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedListId(l.id);
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
