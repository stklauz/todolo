/**
 * Tests for debug logging functionality
 */

import { debugLogger } from '../utils/debug';

describe('Debug Logger', () => {
  beforeEach(() => {
    debugLogger.clear();
  });

  test('should log messages when enabled', () => {
    debugLogger.enable();
    debugLogger.log('info', 'Test message', { data: 'test' });
    
    const logs = debugLogger.getLogs();
    expect(logs).toHaveLength(2); // Enable message + test message
    expect(logs[1].operation).toBe('Test message');
    expect(logs[1].details).toEqual({ data: 'test' });
  });

  test('should not log messages when disabled', () => {
    debugLogger.enable(); // First enable to get the enable message
    debugLogger.disable();
    debugLogger.log('info', 'Test message');
    
    const logs = debugLogger.getLogs();
    expect(logs).toHaveLength(1); // Only the enable message, disable message not logged because logger is disabled
    expect(logs[0].operation).toBe('Debug mode enabled');
  });

  test('should measure timing correctly', () => {
    debugLogger.enable();
    
    const markId = debugLogger.startTiming('test-operation');
    // Simulate some work
    const start = performance.now();
    while (performance.now() - start < 1) {
      // Busy wait for ~1ms
    }
    const duration = debugLogger.endTiming(markId, 'test-operation');
    
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(10); // Should be less than 10ms
    
    const logs = debugLogger.getLogs();
    const perfLogs = logs.filter(log => log.level === 'perf');
    expect(perfLogs).toHaveLength(2); // Start and end
  });

  test('should measure async operations', async () => {
    debugLogger.enable();
    
    const result = await debugLogger.measureAsync('async-test', async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return 'test-result';
    });
    
    expect(result).toBe('test-result');
    
    const logs = debugLogger.getLogs();
    const perfLogs = logs.filter(log => log.level === 'perf' && log.operation.includes('async-test'));
    expect(perfLogs).toHaveLength(2); // Start and end
  });

  test('should generate performance summary', () => {
    debugLogger.enable();
    
    // Create some performance logs
    const mark1 = debugLogger.startTiming('operation1');
    debugLogger.endTiming(mark1, 'operation1');
    
    const mark2 = debugLogger.startTiming('operation2');
    debugLogger.endTiming(mark2, 'operation2');
    
    const mark3 = debugLogger.startTiming('operation1');
    debugLogger.endTiming(mark3, 'operation1');
    
    const summary = debugLogger.getPerformanceSummary();
    
    expect(summary).toHaveProperty('operation1');
    expect(summary).toHaveProperty('operation2');
    expect(summary.operation1.count).toBe(2);
    expect(summary.operation2.count).toBe(1);
  });

  test('should export logs as JSON', () => {
    debugLogger.enable();
    debugLogger.log('info', 'Test message', { data: 'test' });
    
    const exported = debugLogger.exportLogs();
    const parsed = JSON.parse(exported);
    
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('logs');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed.logs).toHaveLength(2); // Enable message + test message
  });
});
