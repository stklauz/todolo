import React from 'react';
import { IoEllipsisHorizontal } from 'react-icons/io5';
import Spinner from '../../../../components/Spinner';
import type { AppSettings } from '../../types';

const styles = require('../TodoApp/TodoApp.module.css');

type ActionsMenuProps = {
  createdAt?: string;
  updatedAt?: string;
  canDelete: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  isDuplicating: boolean;
  showSpinner: boolean;
  appSettings: AppSettings;
  onUpdateAppSettings: (settings: AppSettings) => void;
};

export default function ActionsMenu({
  createdAt: _createdAt,
  updatedAt: _updatedAt,
  canDelete,
  onDelete,
  onDuplicate,
  isDuplicating,
  showSpinner,
  appSettings,
  onUpdateAppSettings,
}: ActionsMenuProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={styles.menuWrap}>
      <button
        type="button"
        className={styles.menuBtn}
        title="List actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        ref={btnRef}
      >
        <IoEllipsisHorizontal size={18} />
      </button>
      {open && (
        <div className={styles.menu} ref={menuRef} role="menu">
          <div className={styles.menuSection}>
            <div className={styles.menuSectionTitle}>App Settings</div>
            <label className={styles.menuToggleItem}>
              <input
                type="checkbox"
                checked={!appSettings.hideCompletedItems}
                onChange={(e) => {
                  onUpdateAppSettings({
                    ...appSettings,
                    hideCompletedItems: !e.target.checked,
                  });
                }}
              />
              <span>Completed items</span>
            </label>
          </div>
          <div className={styles.menuDivider} />
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDuplicate}`}
            role="menuitem"
            data-testid="menu-duplicate-list"
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
            disabled={isDuplicating}
          >
            {showSpinner ? <Spinner size={12} /> : null}
            Duplicate list
          </button>
          <button
            type="button"
            className={styles.menuItemDanger}
            role="menuitem"
            data-testid="menu-delete-list"
            onClick={() => {
              setOpen(false);
              if (canDelete) onDelete();
            }}
            disabled={!canDelete}
            title={
              canDelete ? 'Delete this list' : "Can't delete your only list"
            }
          >
            Delete list
          </button>
        </div>
      )}
    </div>
  );
}
