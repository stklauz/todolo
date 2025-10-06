import React from 'react';
import { IoEllipsisHorizontal } from 'react-icons/io5';
import ListSidebar from './ListSidebar';
import TodoList from './TodoList';
import type { EditorTodo, Section, AppSettings } from '../types';
import useTodosState from '../hooks/useTodosState';
import useDragReorder from '../hooks/useDragReorder';
import { loadAppSettings, saveAppSettings } from '../api/storage';

const styles = require('../styles/TodoApp.module.css');

// TodoApp: An editor-like list of todos spanning multiple lists
// - Each todo is an input you can type in
// - Press Enter in a todo to insert a new one below and focus it
// - There is always at least one todo present

export default function TodoApp(): React.ReactElement {
  const {
    lists,
    setLists,
    selectedListId,
    setSelectedListId,
    getSelectedTodos,
    setSelectedTodos,
    updateTodo,
    toggleTodo,
    changeIndent,
    insertTodoBelow,
    addList,
    deleteList,
  } = useTodosState();

  // App settings state
  const [appSettings, setAppSettings] = React.useState<AppSettings>({
    hideCompletedItems: true,
  });

  // Load app settings on mount
  React.useEffect(() => {
    loadAppSettings().then(setAppSettings);
  }, []);

  // Function to update app settings
  const updateAppSettings = React.useCallback(
    async (newSettings: AppSettings) => {
      setAppSettings(newSettings);
      await saveAppSettings(newSettings);
    },
    [],
  );

  const allTodos: EditorTodo[] = getSelectedTodos();
  const todos: EditorTodo[] = appSettings.hideCompletedItems
    ? allTodos.filter((todo) => !todo.completed)
    : allTodos;
  // REFS: keep values between renders without causing re-renders
  // Track inputs by todo id so we can focus newly inserted rows
  const inputByIdRef = React.useRef(new Map<number, HTMLTextAreaElement>());
  const focusNextIdRef = React.useRef<number | null>(null);

  // Drag state/handlers via hook
  const sectionOf = (id: number): Section => {
    const idx = todos.findIndex((x) => x.id === id);
    if (idx === -1) return 'active';
    const cur = todos[idx];
    const indent = Number(cur.indent ?? 0);
    if (indent <= 0) {
      // parent effective completion: parent must be completed AND all its children completed
      let allChildrenCompleted = true;
      for (let i = idx + 1; i < todos.length; i++) {
        if (Number(todos[i].indent ?? 0) === 0) break;
        if (!todos[i].completed) {
          allChildrenCompleted = false;
          break;
        }
      }
      return cur.completed && allChildrenCompleted ? 'completed' : 'active';
    }
    // child: completed only if child and parent are completed
    let parentCompleted = false;
    for (let i = idx - 1; i >= 0; i--) {
      if (Number(todos[i].indent ?? 0) === 0) {
        parentCompleted = !!todos[i].completed;
        break;
      }
    }
    return cur.completed && parentCompleted ? 'completed' : 'active';
  };
  const {
    dragInfo,
    dropTargetId,
    dropAtSectionEnd,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDropOn,
    handleDragOverEndZone,
    handleDragLeaveEndZone,
    handleDropAtEnd,
  } = useDragReorder(
    () => getSelectedTodos(),
    (updater) => setSelectedTodos(updater),
    sectionOf,
  );

  // Keep the map in sync as inputs mount/unmount
  function setInputRef(id: number, el: HTMLTextAreaElement | null) {
    if (el) inputByIdRef.current.set(id, el);
    else inputByIdRef.current.delete(id);
  }

  // no local load/save effects; handled in useTodosState

  // mutations are provided by useTodosState (updateTodo/toggleTodo)

  // Insert a new todo after the given index and focus it
  function insertBelowAndFocus(index: number, text = '') {
    // If we're filtering completed items, we need to find the correct position in the full list
    if (appSettings.hideCompletedItems) {
      // Find the target todo in the visible list
      const target = todos[index];
      if (!target) return;

      // Find its position in the full list
      const fullIndex = allTodos.findIndex((t) => t.id === target.id);
      if (fullIndex < 0) return;

      // Insert after the found position in the full list
      const id = insertTodoBelow(fullIndex, text);
      focusNextIdRef.current = id;
    } else {
      // No filtering, use index directly
      const id = insertTodoBelow(index, text);
      focusNextIdRef.current = id;
    }
  }

  // Remove the todo at index; focus a neighbor or the bottom box if none left
  function removeAtAndManageFocus(index: number) {
    if (appSettings.hideCompletedItems) {
      // Translate filtered index -> id -> full list index
      const target = todos[index];
      if (!target) return;
      const targetId = target.id;
      setLists((prev) =>
        prev.map((l) => {
          if (l.id !== selectedListId) return l;
          const fullIdx = l.todos.findIndex((t) => t.id === targetId);
          if (fullIdx === -1) return l;
          const next = [...l.todos];
          next.splice(fullIdx, 1);
          if (next.length === 0) {
            focusNextIdRef.current = null;
          } else {
            const focusIdx = Math.max(0, fullIdx - 1);
            const focusTarget = next[focusIdx] ?? next[0];
            if (focusTarget) focusNextIdRef.current = focusTarget.id;
          }
          return { ...l, todos: next, updatedAt: new Date().toISOString() };
        }),
      );
    } else {
      // No filtering, use index directly
      setLists((prev) =>
        prev.map((l) => {
          if (l.id !== selectedListId) return l;
          const next = [...l.todos];
          next.splice(index, 1);
          if (next.length === 0) {
            focusNextIdRef.current = null;
          } else {
            const target = next[Math.max(0, index - 1)] ?? next[0];
            if (target) focusNextIdRef.current = target.id;
          }
          return { ...l, todos: next, updatedAt: new Date().toISOString() };
        }),
      );
    }
  }

  // drag-drop handlers provided by useDragReorder

  // end drag-drop customizations

  // Enter inside a todo: insert a new one below and focus it
  // Compute index by id so this works across split lists
  function handleTodoKeyDown(id: number) {
    return (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Use the full list for operations; UI is filtered
      const index = allTodos.findIndex((t) => t.id === id);
      if (index === -1) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
          changeIndent(id, -1);
        } else {
          // Only allow indenting to level 1 if there is a parent above
          const hasParent = (() => {
            for (let i = index - 1; i >= 0; i--) {
              if (Number(allTodos[i].indent ?? 0) === 0) return true;
            }
            return false;
          })();
          if (hasParent) changeIndent(id, +1);
        }
        return;
      }
      if (event.key === 'Enter') {
        // Prevent newline insertion in textarea
        event.preventDefault();
        const cur = allTodos[index];
        if (!cur || cur.text.trim().length === 0) {
          // Do nothing if current todo is empty
          return;
        }
        // Insert relative to the visible position only if filtering is active
        if (appSettings.hideCompletedItems) {
          const visibleIndex = todos.findIndex((t) => t.id === id);
          if (visibleIndex !== -1) insertBelowAndFocus(visibleIndex);
        } else {
          insertBelowAndFocus(index);
        }
      } else if (event.key === 'Backspace') {
        const isEmpty = allTodos[index]?.text.length === 0;
        if (isEmpty) {
          event.preventDefault();
          const cur = allTodos[index];
          const ind = Number(cur?.indent ?? 0);
          if (ind > 0) {
            // Outdent first when empty
            changeIndent(cur.id, -1);
            return;
          }
          // Prevent deleting the last remaining todo
          if (allTodos.length <= 1) return;
          if (appSettings.hideCompletedItems) {
            const visibleIndex = todos.findIndex((t) => t.id === id);
            if (visibleIndex !== -1) removeAtAndManageFocus(visibleIndex);
          } else {
            removeAtAndManageFocus(index);
          }
        }
      }
    };
  }

  // After the todos array changes, focus the input we marked (if any),
  // otherwise if none left, focus the bottom create input
  React.useEffect(() => {
    // Don't interfere with title editing
    if (isEditingRef.current) return;

    const id = focusNextIdRef.current;
    if (id != null) {
      const el = inputByIdRef.current.get(id);
      if (el) el.focus();
      focusNextIdRef.current = null;
    } else if (todos.length === 1) {
      const only = todos[0];
      const el = inputByIdRef.current.get(only.id);
      if (el) el.focus();
    }
  }, [todos]);

  const [editingListId, setEditingListId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState<string>('');
  const inputJustFocusedRef = React.useRef(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const isEditingRef = React.useRef(false);

  // Focus the input when editing starts (only when editingListId changes)
  React.useEffect(() => {
    if (editingListId === selectedListId && titleInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          // Don't select all text - let user position cursor where they want
        }
      }, 10);
    }
  }, [editingListId]); // Only depend on editingListId, not selectedListId

  // selected list info
  const selectedList = lists.find((l) => l.id === selectedListId) || null;
  const selectedListName = selectedList?.name || 'My List';

  function onAddList() {
    const id = addList();
    isEditingRef.current = true;
    setEditingListId(id);
    setEditingName(`List ${lists.length + 1}`);
  }

  // deleteSelectedList comes from hook

  function startRename(listId: string, current: string) {
    isEditingRef.current = true;
    setEditingListId(listId);
    setEditingName(current);
  }

  function commitRename() {
    if (!editingListId || !isEditingRef.current) return;
    const name = editingName.trim();
    if (!name) {
      setEditingListId(null);
      isEditingRef.current = false;
      return;
    }
    setLists((prev) =>
      prev.map((l) =>
        l.id === editingListId
          ? { ...l, name, updatedAt: new Date().toISOString() }
          : l,
      ),
    );
    setEditingListId(null);
    isEditingRef.current = false;
  }

  function cancelRename() {
    setEditingListId(null);
    isEditingRef.current = false;
  }

  // no debug globals/logs

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <ListSidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelect={(id) => setSelectedListId(id)}
        onAdd={onAddList}
        editingListId={editingListId}
        editingName={editingName}
        onStartRename={startRename}
        onChangeName={setEditingName}
        onCommitRename={commitRename}
        onCancelRename={cancelRename}
      />

      {/* Main content */}
      <div className={styles.container}>
        <div className={styles.titleRow}>
          {editingListId === selectedListId ? (
            <input
              ref={titleInputRef}
              className={styles.titleInput}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
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
                commitRename();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  commitRename();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelRename();
                }
              }}
            />
          ) : (
            <h1
              className={`${styles.title} ${styles.titleClickable}`}
              onClick={() => {
                const targetId = selectedList?.id ?? lists[0]?.id ?? null;
                const currentName =
                  selectedList?.name ?? lists[0]?.name ?? 'My List';
                if (targetId) {
                  startRename(targetId, currentName);
                }
              }}
              title="Click to rename"
            >
              {selectedListName}
            </h1>
          )}
          {selectedList && (
            <ActionsRow
              createdAt={selectedList.createdAt}
              updatedAt={selectedList.updatedAt}
              canDelete={lists.length > 1}
              onDelete={() => deleteList(selectedList.id)}
              appSettings={appSettings}
              onUpdateAppSettings={updateAppSettings}
            />
          )}
        </div>
        {selectedList && (
          <div className={styles.subtitleRow}>
            <div className={styles.subtitle}>
              {selectedList.createdAt ? (
                <span>
                  Created{' '}
                  {new Date(selectedList.createdAt).toLocaleDateString()}{' '}
                </span>
              ) : null}
              {selectedList.updatedAt ? (
                <span>
                  • Updated{' '}
                  {new Date(selectedList.updatedAt).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          </div>
        )}

        <TodoList
          todos={todos}
          updateTodo={updateTodo}
          toggleTodo={toggleTodo}
          insertBelowAndFocus={insertBelowAndFocus}
          handleTodoKeyDown={handleTodoKeyDown}
          changeIndent={changeIndent}
          removeAt={removeAtAndManageFocus}
          dragInfo={dragInfo}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDropOn={handleDropOn}
          dropTargetId={dropTargetId}
          dropAtSectionEnd={dropAtSectionEnd}
          handleDragOverEndZone={handleDragOverEndZone}
          handleDragLeaveEndZone={handleDragLeaveEndZone}
          handleDropAtEnd={handleDropAtEnd}
          setInputRef={setInputRef}
        />
      </div>
    </div>
  );
}

type ActionsRowProps = {
  createdAt?: string;
  updatedAt?: string;
  canDelete: boolean;
  onDelete: () => void;
  appSettings: AppSettings;
  onUpdateAppSettings: (settings: AppSettings) => void;
};

function ActionsRow({
  createdAt,
  updatedAt,
  canDelete,
  onDelete,
  appSettings,
  onUpdateAppSettings,
}: ActionsRowProps) {
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
            className={styles.menuItemDanger}
            role="menuitem"
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
