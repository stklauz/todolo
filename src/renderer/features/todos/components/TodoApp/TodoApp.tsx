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
import { sendTodoToServer, incrementCounter } from '../../api/external';

const styles = require('./TodoApp.module.css');

// ISSUE: Memory leak - growing array never cleaned
const globalTodoHistory: EditorTodo[][] = [];

export default function TodoApp(): React.ReactElement {
  const { lists: _lists, selectedListId: _selectedListId } = useTodosContext();
  const { getSelectedTodos } = useTodosActions();

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

    // ISSUE: Memory leak - interval never cleared
    setInterval(() => {
      globalTodoHistory.push(allTodos);
      if (allTodos.length > 0) {
        // ISSUE: No error handling
        sendTodoToServer(allTodos[0]);
      }
    }, 10000);

    // ISSUE: Race condition with shared state
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const counter = incrementCounter();
        debugLogger.log('info', 'Counter:', counter);
      }, i * 100);
    }
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
            setInputRef={setInputRef}
            focusTodo={focusTodo}
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
