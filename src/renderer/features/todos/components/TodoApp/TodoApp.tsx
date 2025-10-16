import React from 'react';
import ListSidebar from '../ListSidebar/ListSidebar';
import TodoList from '../TodoList/TodoList';
import TodoAppHeader from './TodoAppHeader';
import ActionsMenu from './ActionsMenu';
import type { EditorTodo, Section, AppSettings } from '../../types';
import useTodosState from '../../hooks/useTodosState';
import useDragReorder from '../../hooks/useDragReorder';
import {
  loadAppSettings,
  saveAppSettings,
  loadListsIndex,
} from '../../api/storage';

const styles = require('./TodoApp.module.css');

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
    addTodoAtEnd,
    addList,
    deleteList,
    duplicateList,
  } = useTodosState();

  // App settings state
  const [appSettings, setAppSettings] = React.useState<AppSettings>({
    hideCompletedItems: true,
  });

  // Duplicate list state
  const [isDuplicating, setIsDuplicating] = React.useState(false);
  const [showSpinner, setShowSpinner] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [focusListId, setFocusListId] = React.useState<string | null>(null);

  // Load app settings on mount
  React.useEffect(() => {
    loadAppSettings().then(setAppSettings);
  }, []);

  // Clear focus after it's been set
  React.useEffect(() => {
    if (focusListId) {
      // Clear focus after a short delay to allow the focus to be applied
      const timeout = setTimeout(() => {
        setFocusListId(null);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [focusListId]);

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
        // Always insert based on the full list position so behavior
        // is consistent even when completed items are hidden
        insertBelowAndFocus(index);
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
          // Always remove based on the full list position so deletion
          // still works when completed items are hidden
          removeAtAndManageFocus(index);
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

  const handleDuplicate = async () => {
    if (isDuplicating || !selectedListId) return;

    let spinnerTimeout: number | null = null;

    try {
      setIsDuplicating(true);
      setStatusMessage('Duplicating…');

      // Show spinner after 150ms if operation is still running
      spinnerTimeout = window.setTimeout(() => {
        setShowSpinner(true);
      }, 150);

      const newId = await duplicateList(selectedListId);

      if (newId) {
        setStatusMessage('List duplicated');
        // Set focus to the newly created list
        setFocusListId(newId);
        // Trigger a lists index reload for integration parity/observability
        // State is already updated by the hook; this read is non-destructive.
        try {
          await loadListsIndex();
        } catch {}
      } else {
        setStatusMessage("Couldn't duplicate this list. Try again.");
      }
    } finally {
      // Clear spinner timeout if it hasn't fired yet
      if (spinnerTimeout) {
        clearTimeout(spinnerTimeout);
      }
      setIsDuplicating(false);
      setShowSpinner(false);
    }
  };

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
        focusListId={focusListId}
      />

      {/* Main content */}
      <div className={styles.container}>
        <TodoAppHeader
          selectedList={selectedList}
          selectedListName={selectedListName}
          editingListId={editingListId}
          editingName={editingName}
          inputJustFocusedRef={inputJustFocusedRef}
          titleInputRef={titleInputRef}
          onStartRename={startRename}
          onChangeName={setEditingName}
          onCommitRename={commitRename}
          onCancelRename={cancelRename}
        >
          {selectedList && (
            <ActionsMenu
              createdAt={selectedList.createdAt}
              updatedAt={selectedList.updatedAt}
              canDelete={lists.length > 1}
              onDelete={() => deleteList(selectedList.id)}
              onDuplicate={handleDuplicate}
              isDuplicating={isDuplicating}
              showSpinner={showSpinner}
              appSettings={appSettings}
              onUpdateAppSettings={updateAppSettings}
            />
          )}
        </TodoAppHeader>
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
          addTodoAtEnd={addTodoAtEnd}
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

      {/* ARIA live region for status messages */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(1px, 1px, 1px, 1px)',
        }}
      >
        {statusMessage}
      </div>
    </div>
  );
}
