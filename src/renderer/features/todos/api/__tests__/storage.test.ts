import {
  loadListsIndex,
  saveListTodos,
  loadAppSettings,
  loadListTodos,
} from '../storage';
import { debugLogger } from '../../../../utils/debug';

// Helper to access the global invoke mock configured in test setup
const getInvokeMock = (): jest.Mock => {
  return (window as any).electron.ipcRenderer.invoke as jest.Mock;
};

describe('Storage API (minimal)', () => {
  beforeEach(() => {
    debugLogger.clear();
    const invoke = getInvokeMock();
    invoke.mockReset();
  });

  afterEach(() => {
    // Ensure no state persists across tests
    debugLogger.clear();
    debugLogger.disable();
  });

  describe('loadListsIndex', () => {
    test('happy path: returns lists and calls correct channel (IPC contract)', async () => {
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({
        version: 2,
        lists: [
          {
            id: 'a',
            name: 'A',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        selectedListId: 'a',
      });

      const result = await loadListsIndex();

      expect(mockInvoke).toHaveBeenCalledWith('load-lists');
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        version: 2,
        lists: [
          {
            id: 'a',
            name: 'A',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        selectedListId: 'a',
      });
    });

    test('returns lists in the expected order', async () => {
      const mockInvoke = getInvokeMock();
      const listOldest = {
        id: '1',
        name: 'B',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };
      const listLatest = {
        id: '2',
        name: 'A',
        createdAt: '2025-01-02T00:00:00.000Z',
        updatedAt: '2025-12-01T00:00:00.000Z',
      };
      const listMiddle = {
        id: '3',
        name: 'C',
        createdAt: '2025-01-03T00:00:00.000Z',
        updatedAt: '2025-06-01T00:00:00.000Z',
      };
      mockInvoke.mockResolvedValue({
        version: 2,
        lists: [listOldest, listLatest, listMiddle],
        selectedListId: listOldest.id,
      });

      const result = await loadListsIndex();

      expect(mockInvoke).toHaveBeenCalledWith('load-lists');
      expect(result.lists).toEqual([listLatest, listMiddle, listOldest]);
    });

    test('filters out lists missing updatedAt', async () => {
      const mockInvoke = getInvokeMock();
      const valid = {
        id: 'ok',
        name: 'Valid',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      };
      mockInvoke.mockResolvedValue({
        version: 2,
        lists: [
          valid,
          { id: 'bad', name: 'Missing', createdAt: '2025-01-03T00:00:00.000Z' },
        ],
        selectedListId: 'ok',
      });

      const result = await loadListsIndex();

      expect(result.lists).toEqual([valid]);
    });

    test('ipc rejection: returns safe default and logs error', async () => {
      debugLogger.enable();
      const mockInvoke = getInvokeMock();
      mockInvoke.mockRejectedValue(new Error('boom'));

      const result = await loadListsIndex();

      expect(result).toEqual({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });
      const errors = debugLogger.getLogs().filter((l) => l.level === 'error');
      const operations = errors.map((e) => e.operation).join(' | ');
      expect(operations).toContain('Failed to load lists index');
    });

    test('malformed payload: wrong shape → safe default', async () => {
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({ version: 3, lists: 'nope' } as any);

      const result = await loadListsIndex();
      expect(result).toEqual({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });
    });

    test('wrong version: valid shape but version != 2 → safe default and warn', async () => {
      debugLogger.enable();
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({
        version: 3,
        lists: [
          {
            id: 'x',
            name: 'X',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'x',
      } as any);

      const result = await loadListsIndex();
      expect(result).toEqual({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });
      const warns = debugLogger.getLogs().filter((l) => l.level === 'warn');
      const operations = warns.map((e) => e.operation).join(' | ');
      expect(operations).toContain('Malformed lists index payload');
    });
  });

  describe('saveListTodos', () => {
    test('happy path: calls correct channel/args and returns true (IPC contract)', async () => {
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({ success: true });

      const doc = { version: 2 as const, todos: [] };
      const ok = await saveListTodos('list-1', doc);

      expect(ok).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('save-list-todos', 'list-1', doc);
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    test('ipc rejection: returns false and logs error', async () => {
      debugLogger.enable();
      const mockInvoke = getInvokeMock();
      mockInvoke.mockRejectedValue(new Error('nope'));

      const ok = await saveListTodos('list-1', { version: 2, todos: [] });

      expect(ok).toBe(false);
      const errors = debugLogger.getLogs().filter((l) => l.level === 'error');
      const operations = errors.map((e) => e.operation).join(' | ');
      expect(operations).toContain('Failed to save list todos');
    });

    test('malformed IPC response: missing success → returns false', async () => {
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({} as any);

      const ok = await saveListTodos('list-2', { version: 2, todos: [] });
      expect(ok).toBe(false);
    });
  });

  describe('loadAppSettings', () => {
    test('happy path: returns settings and calls correct channel (IPC contract)', async () => {
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({ hideCompletedItems: false });

      const settings = await loadAppSettings();
      expect(mockInvoke).toHaveBeenCalledWith('load-app-settings');
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(settings).toEqual({ hideCompletedItems: false });
    });

    test('ipc rejection: returns safe default and logs error', async () => {
      debugLogger.enable();
      const mockInvoke = getInvokeMock();
      mockInvoke.mockRejectedValue(new Error('oops'));

      const settings = await loadAppSettings();
      expect(settings).toEqual({ hideCompletedItems: true });
      const errors = debugLogger.getLogs().filter((l) => l.level === 'error');
      const operations = errors.map((e) => e.operation).join(' | ');
      expect(operations).toContain('Failed to load app settings');
    });

    test('malformed payload: wrong type → safe default', async () => {
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({ hideCompletedItems: 'yes' } as any);

      const settings = await loadAppSettings();
      expect(settings).toEqual({ hideCompletedItems: true });
    });
  });

  describe('loadListTodos (malformed payload parity)', () => {
    test('malformed payload: missing todos → safe default', async () => {
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({ version: 2 } as any);

      const res = await loadListTodos('x');
      expect(mockInvoke).toHaveBeenCalledWith('load-list-todos', 'x');
      expect(res).toEqual({ version: 3, todos: [] });
    });

    test('malformed payload: wrong type for todos → safe default and warn', async () => {
      debugLogger.enable();
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({ version: 2, todos: 'nope' } as any);

      const res = await loadListTodos('list-123');
      expect(res).toEqual({ version: 3, todos: [] });
      const warns = debugLogger.getLogs().filter((l) => l.level === 'warn');
      const operations = warns.map((e) => e.operation).join(' | ');
      expect(operations).toContain('Malformed todos payload');
    });

    test('wrong version: version != 2 with valid todos → safe default and warn', async () => {
      debugLogger.enable();
      const mockInvoke = getInvokeMock();
      mockInvoke.mockResolvedValue({ version: 3, todos: [] } as any);

      const res = await loadListTodos('list-abc');
      expect(res).toEqual({ version: 3, todos: [] });
      const warns = debugLogger.getLogs().filter((l) => l.level === 'warn');
      const operations = warns.map((e) => e.operation).join(' | ');
      expect(operations).toContain('Malformed todos payload');
    });
  });
});
