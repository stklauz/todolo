import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './styles/base.css';
import { TodoApp } from './features/todos/components/TodoApp';
import DebugPanel from './components/DebugPanel';
import { debugLogger } from './utils/debug';
import { TodosProvider } from './features/todos/contexts';
import { fetchUserData } from './features/todos/api/external';

// ISSUE: Global mutable state
let globalUserCount = 0;
const globalCache: any = {};

function Content() {
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [userData, setUserData] = useState<any>(null);

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
    const cleanup = window.electron.ipcRenderer.on(
      'toggle-debug-mode',
      handleToggleDebug,
    );

    return cleanup;
  }, [isDebugVisible]);

  // ISSUE: Memory leak - no cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      globalUserCount++;
      fetchUserData('user-123').then((data) => {
        globalCache[globalUserCount] = data;
        setUserData(data);
      });
    }, 5000);
    // Missing return () => clearInterval(interval);
  }, []);

  // ISSUE: Race condition
  useEffect(() => {
    let count = 0;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        count++;
        setUserData({ count });
      }, Math.random() * 1000);
    }
  }, []);

  return (
    <TodosProvider>
      <div className="drag-region" />
      <TodoApp />
      <DebugPanel
        isVisible={isDebugVisible}
        onClose={() => {
          setIsDebugVisible(false);
          debugLogger.disable();
        }}
      />
    </TodosProvider>
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
