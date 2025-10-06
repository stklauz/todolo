import React, { useState, useEffect } from 'react';
import { debugLogger, DebugLogEntry } from '../utils/debug';
import './DebugPanel.css';

interface DebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ isVisible, onClose }) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<'logs' | 'performance'>(
    'logs',
  );

  useEffect(() => {
    if (!isVisible) return;

    const updateLogs = () => {
      setLogs(debugLogger.getLogs());
    };

    // Update logs every 500ms when panel is visible
    const interval = setInterval(updateLogs, 500);
    updateLogs(); // Initial load

    return () => clearInterval(interval);
  }, [isVisible]);

  const filteredLogs = logs.filter(
    (log) =>
      log.operation.toLowerCase().includes(filter.toLowerCase()) ||
      log.level.toLowerCase().includes(filter.toLowerCase()),
  );

  const performanceSummary = debugLogger.getPerformanceSummary();

  const exportLogs = () => {
    const data = debugLogger.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todolo-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    debugLogger.clear();
    setLogs([]);
  };

  if (!isVisible) return null;

  return (
    <div className="debug-panel">
      <div className="debug-panel-header">
        <h3>Debug Panel</h3>
        <div className="debug-panel-controls">
          <button onClick={exportLogs} className="debug-btn">
            Export Logs
          </button>
          <button onClick={clearLogs} className="debug-btn">
            Clear
          </button>
          <button onClick={onClose} className="debug-btn debug-btn-close">
            ×
          </button>
        </div>
      </div>

      <div className="debug-panel-tabs">
        <button
          className={`debug-tab ${selectedTab === 'logs' ? 'active' : ''}`}
          onClick={() => setSelectedTab('logs')}
        >
          Logs ({logs.length})
        </button>
        <button
          className={`debug-tab ${selectedTab === 'performance' ? 'active' : ''}`}
          onClick={() => setSelectedTab('performance')}
        >
          Performance
        </button>
      </div>

      {selectedTab === 'logs' && (
        <div className="debug-panel-content">
          <div className="debug-filter">
            <input
              type="text"
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="debug-filter-input"
            />
          </div>
          <div className="debug-logs">
            {filteredLogs
              .slice(-50)
              .reverse()
              .map((log, index) => (
                <div key={index} className={`debug-log debug-log-${log.level}`}>
                  <span className="debug-log-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="debug-log-operation">{log.operation}</span>
                  {log.details && (
                    <span className="debug-log-details">
                      {typeof log.details === 'string'
                        ? log.details
                        : JSON.stringify(log.details)}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {selectedTab === 'performance' && (
        <div className="debug-panel-content">
          <div className="performance-summary">
            <h4>Performance Summary</h4>
            {Object.keys(performanceSummary).length === 0 ? (
              <p>No performance data available</p>
            ) : (
              <div className="performance-stats">
                {Object.entries(performanceSummary).map(
                  ([operation, stats]) => (
                    <div key={operation} className="performance-stat">
                      <div className="performance-operation">{operation}</div>
                      <div className="performance-metrics">
                        <span>Count: {stats.count}</span>
                        <span>Total: {stats.totalTime.toFixed(2)}ms</span>
                        <span>Avg: {stats.avgTime.toFixed(2)}ms</span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
