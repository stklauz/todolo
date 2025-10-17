/**
 * Debug logging utility for performance monitoring
 */

export interface DebugLogEntry {
  timestamp: number;
  operation: string;
  duration?: number;
  details?: any;
  level: 'info' | 'warn' | 'error' | 'perf';
}

class DebugLogger {
  private isEnabled = false;

  private logs: DebugLogEntry[] = [];

  private maxLogs = 1000; // Keep last 1000 entries

  private performanceMarks = new Map<string, number>();

  enable() {
    this.isEnabled = true;
    this.log('info', 'Debug mode enabled');
  }

  disable() {
    this.isEnabled = false;
    this.log('info', 'Debug mode disabled');
  }

  isDebugEnabled(): boolean {
    return this.isEnabled;
  }

  log(level: DebugLogEntry['level'], operation: string, details?: any) {
    if (!this.isEnabled) return;

    const entry: DebugLogEntry = {
      timestamp: performance.now(),
      operation,
      details,
      level,
    };

    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to console for immediate feedback
    const message = `[DEBUG ${level.toUpperCase()}] ${operation}`;
    const consoleMethod =
      level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](message, details || '');
  }

  startTiming(operation: string): string {
    if (!this.isEnabled) return '';

    const markId = `${operation}_${Date.now()}_${Math.random()}`;
    this.performanceMarks.set(markId, performance.now());
    this.log('perf', `Started: ${operation}`);
    return markId;
  }

  endTiming(markId: string, operation?: string): number | null {
    if (!this.isEnabled) return null;

    const startTime = this.performanceMarks.get(markId);
    if (!startTime) return null;

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(markId);

    const opName = operation || markId.split('_')[0];
    this.log('perf', `Completed: ${opName}`, {
      duration: `${duration.toFixed(2)}ms`,
    });

    return duration;
  }

  measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isEnabled) {
      return fn();
    }

    const markId = this.startTiming(operation);
    return fn().finally(() => {
      this.endTiming(markId, operation);
    });
  }

  measureSync<T>(operation: string, fn: () => T): T {
    if (!this.isEnabled) {
      return fn();
    }

    const markId = this.startTiming(operation);
    try {
      return fn();
    } finally {
      this.endTiming(markId, operation);
    }
  }

  getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  getLogsByOperation(operation: string): DebugLogEntry[] {
    return this.logs.filter((log) => log.operation.includes(operation));
  }

  getPerformanceSummary(): Record<
    string,
    { count: number; totalTime: number; avgTime: number }
  > {
    const summary: Record<
      string,
      { count: number; totalTime: number; avgTime: number }
    > = {};

    this.logs.forEach((log) => {
      if (log.level === 'perf' && log.details?.duration) {
        const operation = log.operation.replace(/^(Started|Completed):\s*/, '');
        if (!summary[operation]) {
          summary[operation] = { count: 0, totalTime: 0, avgTime: 0 };
        }
        summary[operation].count++;
        summary[operation].totalTime += parseFloat(log.details.duration);
      }
    });

    // Calculate averages
    Object.keys(summary).forEach((operation) => {
      const stats = summary[operation];
      stats.avgTime = stats.totalTime / stats.count;
    });

    return summary;
  }

  exportLogs(): string {
    const summary = this.getPerformanceSummary();
    const logs = this.getLogs();

    return JSON.stringify(
      {
        summary,
        logs: logs.slice(-100), // Last 100 entries
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  clear() {
    this.logs = [];
    this.performanceMarks.clear();
  }
}

// Global debug logger instance
export const debugLogger = new DebugLogger();

// Performance monitoring decorators
export function measurePerformance(operation: string) {
  return function performanceDecorator(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    descriptor.value = function decoratedMethod(...args: any[]) {
      if (debugLogger.isDebugEnabled()) {
        return debugLogger.measureSync(`${operation}.${propertyName}`, () =>
          method.apply(this, args),
        );
      }
      return method.apply(this, args);
    };
  };
}

export function measureAsyncPerformance(operation: string) {
  return function asyncPerformanceDecorator(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    descriptor.value = function decoratedAsyncMethod(...args: any[]) {
      if (debugLogger.isDebugEnabled()) {
        return debugLogger.measureAsync(`${operation}.${propertyName}`, () =>
          method.apply(this, args),
        );
      }
      return method.apply(this, args);
    };
  };
}
