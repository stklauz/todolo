import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './styles/base.css';
import { TodoApp } from './features/todos/components/TodoApp';
import DebugPanel from './components/DebugPanel';
import { debugLogger } from './utils/debug';

function Content() {
  const [isDebugVisible, setIsDebugVisible] = useState(false);

  useEffect(() => {
    // Listen for debug mode toggle from main process
    const handleToggleDebug = () => {
      const newState = !isDebugVisible;
      setIsDebugVisible(newState);
      if (newState) {
        debugLogger.enable();
      } else {
        debugLogger.disable();
      }
    };

    // Listen for IPC message from main process and get cleanup function
    // eslint-disable-next-line no-undef
    const cleanup = window.electron.ipcRenderer.on(
      'toggle-debug-mode',
      handleToggleDebug,
    );

    return cleanup;
  }, [isDebugVisible]);

  // Set theme based on system preference
  useEffect(() => {
    const mm =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : undefined;

    const updateTheme = () => {
      const isDark = mm?.matches ?? false;
      const root = document.documentElement;
      if (isDark) {
        root.dataset.theme = 'dark';
      } else {
        delete root.dataset.theme;
      }
    };

    // Set initial theme
    updateTheme();

    // Listen for system theme changes when supported
    if (mm) {
      mm.addEventListener('change', updateTheme);
    }

    return () => {
      if (mm) mm.removeEventListener('change', updateTheme);
    };
  }, []);

  return (
    <>
      <div className="drag-region" />
      <TodoApp />
      <DebugPanel
        isVisible={isDebugVisible}
        onClose={() => {
          setIsDebugVisible(false);
          debugLogger.disable();
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Content />} />
      </Routes>
    </Router>
  );
}
