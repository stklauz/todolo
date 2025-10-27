import React from 'react';
import ListSidebar from '../ListSidebar/ListSidebar';
import TodoList from '../TodoList/TodoList';
import TodoListHeader from '../TodoListHeader/TodoListHeader';
import type { AppSettings } from '../../types';
import { useTodosContext, useTodosActions } from '../../contexts/TodosProvider';
import useTodoFocus, { useTodoFocusEffect } from '../../hooks/useTodoFocus';
import useListEditing from '../../hooks/useListEditing';
import useListDuplication from '../../hooks/useListDuplication';
import { loadAppSettings, saveAppSettings } from '../../api/storage';
import { debugLogger } from '../../../../utils/debug';

const styles = require('./TodoApp.module.css');

export default function TodoApp(): React.ReactElement {
  const { lists: _lists, selectedListId: _selectedListId } = useTodosContext();
  const { getSelectedTodos, changeIndent, insertTodoBelow, removeTodoAt } =
    useTodosActions();

  const [appSettings, setAppSettings] = React.useState<AppSettings>({
    hideCompletedItems: true,
  });
  const { statusMessage } = useListDuplication();

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

  const allTodos = getSelectedTodos();

  const { inputByIdRef, focusNextIdRef, setInputRef, focusTodo } =
    useTodoFocus();

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
        const newId = insertTodoBelow(index, '');
        focusTodo(newId);
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
          removeTodoAt(index);
          // Focus the previous todo after deletion
          const prevTodo = allTodos[index - 1];
          if (prevTodo) {
            focusTodo(prevTodo.id);
          }
        }
      }
    };
  }

  const { isEditingRef } = useListEditing();

  useTodoFocusEffect(allTodos, focusNextIdRef, inputByIdRef, isEditingRef);

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <ListSidebar />

      {/* Main content */}
      <div className={styles.container}>
        <div className={styles.content}>
          <TodoListHeader
            appSettings={appSettings}
            onUpdateAppSettings={updateAppSettings}
          />

          <TodoList
            appSettings={appSettings}
            handleTodoKeyDown={handleTodoKeyDown}
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
