import React from 'react';
import ListSidebar from '../ListSidebar/ListSidebar';
import TodoList from '../TodoList/TodoList';
import TodoListHeader from '../TodoListHeader/TodoListHeader';
import ActionsMenu from '../TodoListHeader/ActionsMenu';
import type { EditorTodo, Section, AppSettings } from '../../types';
import { useTodosContext, useTodosActions } from '../../contexts/TodosProvider';
import useDragReorder from '../../hooks/useDragReorder';
import useTodoFocus, { useTodoFocusEffect } from '../../hooks/useTodoFocus';
import useListEditing from '../../hooks/useListEditing';
import useFilteredTodos from '../../hooks/useFilteredTodos';
import useListDuplication from '../../hooks/useListDuplication';
import {
  loadAppSettings,
  saveAppSettings,
  loadListsIndex,
} from '../../api/storage';
import { debugLogger } from '../../../../utils/debug';

const styles = require('./TodoApp.module.css');

export default function TodoApp(): React.ReactElement {
  const { lists, selectedListId } = useTodosContext();
  const {
    setSelectedListId,
    getSelectedTodos,
    setSelectedTodos,
    updateTodo,
    toggleTodo,
    changeIndent,
    insertTodoBelow,
    removeTodoAt,
    addList,
    deleteList,
    duplicateList,
    updateList,
  } = useTodosActions();

  const [appSettings, setAppSettings] = React.useState<AppSettings>({
    hideCompletedItems: true,
  });
  const {
    isDuplicating,
    showSpinner,
    statusMessage,
    focusListId,
    handleDuplicate: handleDuplicateBase,
  } = useListDuplication();

  React.useEffect(() => {
    loadAppSettings()
      .then(setAppSettings)
      .catch((error) => {
        // Handle load failure gracefully - keep default settings
        debugLogger.log(
          'warn',
          'Failed to load app settings, using defaults',
          error,
        );
      });
  }, []);
  const updateAppSettings = React.useCallback(
    async (newSettings: AppSettings) => {
      setAppSettings(newSettings);
      await saveAppSettings(newSettings);
    },
    [],
  );

  const allTodos: EditorTodo[] = getSelectedTodos();

  const { inputByIdRef, focusNextIdRef, setInputRef, focusTodo } =
    useTodoFocus();
  const {
    filteredTodos: todos,
    insertBelowAndFocus,
    removeAtAndManageFocus,
  } = useFilteredTodos(
    allTodos,
    appSettings.hideCompletedItems,
    insertTodoBelow,
    removeTodoAt,
    setSelectedTodos,
    focusTodo,
  );

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
        insertBelowAndFocus(id);
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
          removeAtAndManageFocus(id);
        }
      }
    };
  }

  const {
    editingListId,
    editingName,
    inputJustFocusedRef,
    titleInputRef,
    isEditingRef,
    startRename,
    setEditingName,
    cancelRename,
    commitRename: commitRenameBase,
  } = useListEditing();

  useTodoFocusEffect(todos, focusNextIdRef, inputByIdRef, isEditingRef);
  const selectedList = lists.find((l) => l.id === selectedListId) || null;
  const selectedListName = selectedList?.name || 'My List';

  function onAddList() {
    const id = addList();
    startRename(id, `List ${lists.length + 1}`);
  }

  function commitRename() {
    if (!editingListId || !isEditingRef.current) return;
    const name = editingName.trim();
    if (!name) {
      cancelRename();
      return;
    }
    updateList(editingListId, { name });
    commitRenameBase();
  }

  const handleDuplicate = async () => {
    if (!selectedListId) return;

    const duplicateListWithReload = async (id: string) => {
      const newId = await duplicateList(id);
      if (newId) {
        try {
          await loadListsIndex();
        } catch {}
      }
      return newId;
    };

    await handleDuplicateBase(selectedListId, duplicateListWithReload);
  };

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
        <div className={styles.content}>
          <TodoListHeader
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
          </TodoListHeader>
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
    </div>
  );
}
