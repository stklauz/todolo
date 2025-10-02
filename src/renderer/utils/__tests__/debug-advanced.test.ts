import { debugLogger, measurePerformance, measureAsyncPerformance } from '../debug';

describe('Debug Logger – advanced coverage', () => {
  beforeEach(() => {
    debugLogger.clear();
    debugLogger.enable();
  });

  afterEach(() => {
    debugLogger.clear();
    debugLogger.disable();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('measureSync produces perf logs and returns result', () => {
    const nowSpy = jest.spyOn(performance, 'now');
    // Start mark, start log, end mark, end log
    nowSpy
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(101)
      .mockReturnValueOnce(108)
      .mockReturnValueOnce(109);

    const result = debugLogger.measureSync('sync-op', () => 42);
    expect(result).toBe(42);

    const perfLogs = debugLogger.getLogs().filter((l) => l.level === 'perf' && l.operation.includes('sync-op'));
    expect(perfLogs).toHaveLength(2);
  });

  test('decorators: measurePerformance (sync) and measureAsyncPerformance (async)', async () => {
    class Example {
      compute(x: number) {
        return x * 2;
      }

      async computeAsync(x: number) {
        await new Promise((r) => setTimeout(r, 5));
        return x * 3;
      }
    }

    // Apply decorators manually to avoid relying on TS decorator transpilation
    const syncDesc = Object.getOwnPropertyDescriptor(Example.prototype, 'compute')!;
    measurePerformance('Example')(Example.prototype as any, 'compute', syncDesc as any);
    Object.defineProperty(Example.prototype, 'compute', syncDesc);

    const asyncDesc = Object.getOwnPropertyDescriptor(Example.prototype, 'computeAsync')!;
    measureAsyncPerformance('Example')(Example.prototype as any, 'computeAsync', asyncDesc as any);
    Object.defineProperty(Example.prototype, 'computeAsync', asyncDesc);

    jest.useFakeTimers();
    const nowSpy = jest.spyOn(performance, 'now');
    // For sync decorated method
    nowSpy
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(201)
      .mockReturnValueOnce(205)
      .mockReturnValueOnce(206)
      // For async decorated method (start/end around await)
      .mockReturnValueOnce(300)
      .mockReturnValueOnce(301)
      .mockReturnValueOnce(309)
      .mockReturnValueOnce(310);

    const ex = new Example();
    expect(ex.compute(5)).toBe(10);

    const p = ex.computeAsync(7);
    await Promise.resolve();
    jest.advanceTimersByTime(5);
    const asyncResult = await p;
    expect(asyncResult).toBe(21);

    const perfLogs = debugLogger.getLogs().filter((l) => l.level === 'perf' && l.operation.includes('Example'));
    expect(perfLogs).toHaveLength(4); // 2 for sync, 2 for async
  });

  test('log buffer cap retains only last 1000 entries', () => {
    // Push many logs beyond cap
    const totalMessages = 1105;
    for (let i = 0; i < totalMessages; i++) {
      debugLogger.log('info', `msg-${i}`);
    }
    const logs = debugLogger.getLogs();
    expect(logs.length).toBe(1000);

    // We added 1 enable message + 1105 msgs = 1106 total; 1106 - 1000 = 106 dropped
    // Dropped include the enable log and msg-0..msg-104; first kept is msg-105
    expect(logs[0].operation).toBe('msg-105');
    expect(logs[logs.length - 1].operation).toBe('msg-1104');
  });

  test('getLogsByOperation returns entries by substring', () => {
    debugLogger.log('info', 'alpha.run');
    debugLogger.log('info', 'alpha.done');
    debugLogger.log('info', 'beta.run');

    const alpha = debugLogger.getLogsByOperation('alpha');
    expect(alpha.map((l) => l.operation)).toEqual(['alpha.run', 'alpha.done']);
  });

  test('getPerformanceSummary computes count, totalTime, avgTime', () => {
    const nowSpy = jest.spyOn(performance, 'now');
    // operation1: 5ms twice
    nowSpy
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(101)
      .mockReturnValueOnce(105)
      .mockReturnValueOnce(106)
      .mockReturnValueOnce(110)
      .mockReturnValueOnce(111)
      .mockReturnValueOnce(115)
      .mockReturnValueOnce(116)
      // operation2: 10ms once
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(201)
      .mockReturnValueOnce(210)
      .mockReturnValueOnce(211);

    const m1 = debugLogger.startTiming('operation1');
    debugLogger.endTiming(m1, 'operation1');
    const m2 = debugLogger.startTiming('operation1');
    debugLogger.endTiming(m2, 'operation1');
    const m3 = debugLogger.startTiming('operation2');
    debugLogger.endTiming(m3, 'operation2');

    const summary = debugLogger.getPerformanceSummary();
    expect(summary.operation1.count).toBe(2);
    expect(summary.operation2.count).toBe(1);
    // parseFloat ignores the trailing 'ms'; toFixed(2) precision means 5.00 + 5.00
    expect(summary.operation1.totalTime).toBeCloseTo(10, 2);
    expect(summary.operation1.avgTime).toBeCloseTo(5, 2);
    expect(summary.operation2.totalTime).toBeCloseTo(10, 2);
    expect(summary.operation2.avgTime).toBeCloseTo(10, 2);
  });
});
