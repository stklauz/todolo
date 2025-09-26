import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './styles/base.css';
import TodoApp from './features/todos/components/TodoApp';
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

    // Listen for IPC message from main process
    window.electron.ipcRenderer.on('toggle-debug-mode', handleToggleDebug);

    return () => {
      window.electron.ipcRenderer.removeListener('toggle-debug-mode', handleToggleDebug);
    };
  }, [isDebugVisible]);

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
        <Route path="/" element={ <Content /> } />
      </Routes>
    </Router>
  );
}
