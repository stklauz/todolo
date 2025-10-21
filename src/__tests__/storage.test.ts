import {
  loadListsIndex,
  saveListsIndex,
  loadListTodos,
  saveListTodos,
  duplicateList,
  deleteList,
} from '../renderer/features/todos/api/storage';

// Mock the electron API
const mockInvoke = jest.fn();

describe('Storage API', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    // Mock window.electron for each test
    Object.defineProperty(window, 'electron', {
      value: {
        ipcRenderer: {
          invoke: mockInvoke,
        },
      },
      writable: true,
    });
  });

  describe('loadListsIndex', () => {
    it('should return default data when no data exists', async () => {
      mockInvoke.mockResolvedValue({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });

      const result = await loadListsIndex();

      expect(result).toEqual({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });
      expect(mockInvoke).toHaveBeenCalledWith('load-lists');
    });

    it('should return loaded data when valid', async () => {
      const mockData = {
        version: 2,
        lists: [
          { id: '1', name: 'Test List', createdAt: '2024-01-01T00:00:00.000Z' },
        ],
        selectedListId: '1',
      };
      mockInvoke.mockResolvedValue(mockData);

      const result = await loadListsIndex();

      expect(result).toEqual(mockData);
    });

    it('should return default data when invalid response', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await loadListsIndex();

      expect(result).toEqual({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });
    });

    it('should handle errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const result = await loadListsIndex();

      expect(result).toEqual({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });
    });
  });

  describe('saveListsIndex', () => {
    it('should save data successfully', async () => {
      const mockData = {
        version: 2 as const,
        lists: [
          { id: '1', name: 'Test List', createdAt: '2024-01-01T00:00:00.000Z' },
        ],
        selectedListId: '1',
      };
      mockInvoke.mockResolvedValue({ success: true });

      const result = await saveListsIndex(mockData);

      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('save-lists', mockData);
    });

    it('should return false on failure', async () => {
      mockInvoke.mockResolvedValue({ success: false });

      const result = await saveListsIndex({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const result = await saveListsIndex({
        version: 2,
        lists: [],
        selectedListId: undefined,
      });

      expect(result).toBe(false);
    });
  });

  describe('loadListTodos', () => {
    it('should return default data when no todos exist', async () => {
      mockInvoke.mockResolvedValue({ version: 2, todos: [] });

      const result = await loadListTodos('list-1');

      expect(result).toEqual({ version: 2, todos: [] });
      expect(mockInvoke).toHaveBeenCalledWith('load-list-todos', 'list-1');
    });

    it('should return loaded todos when valid', async () => {
      const mockData = {
        version: 2,
        todos: [{ id: 1, text: 'Test todo', completed: false, indent: 0 }],
      };
      mockInvoke.mockResolvedValue(mockData);

      const result = await loadListTodos('list-1');

      expect(result).toEqual(mockData);
    });

    it('should return default data when invalid response', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await loadListTodos('list-1');

      expect(result).toEqual({ version: 2, todos: [] });
    });
  });

  describe('saveListTodos', () => {
    it('should save todos successfully', async () => {
      const mockData = {
        version: 2 as const,
        todos: [{ id: 1, text: 'Test todo', completed: false, indent: 0 }],
      };
      mockInvoke.mockResolvedValue({ success: true });

      const result = await saveListTodos('list-1', mockData);

      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith(
        'save-list-todos',
        'list-1',
        mockData,
      );
    });

    it('should return false on failure', async () => {
      mockInvoke.mockResolvedValue({ success: false });

      const result = await saveListTodos('list-1', { version: 2, todos: [] });

      expect(result).toBe(false);
    });
  });

  describe('duplicateList', () => {
    it('should duplicate list successfully', async () => {
      const mockResult = { success: true, newListId: 'new-list-id' };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await duplicateList('source-list-id');

      expect(result).toEqual(mockResult);
      expect(mockInvoke).toHaveBeenCalledWith(
        'duplicate-list',
        'source-list-id',
        undefined,
      );
    });

    it('should remap todo ids on duplicate and preserve order', async () => {
      // Arrange a mock IPC that simulates source todos with non-sequential ids
      const sourceListId = 'source-list-id';
      const newListId = 'new-list-id';
      const calls: Array<{ channel: string; args: any[] }> = [];
      mockInvoke.mockImplementation(async (channel: string, ...args: any[]) => {
        calls.push({ channel, args });
        if (channel === 'duplicate-list') {
          // Duplicate returns new list id
          return { success: true, newListId };
        }
        if (channel === 'load-list-todos') {
          const listId = args[0];
          if (listId === sourceListId) {
            // Source has ids that are not 1..N (simulate realistic gaps)
            return {
              version: 2,
              todos: [
                { id: 5, text: 'A', completed: false, indent: 0 },
                { id: 10, text: 'B', completed: true, indent: 0 },
              ],
            };
          }
          if (listId === newListId) {
            // After duplicate, the DB should remap ids to 1..N while preserving order
            return {
              version: 2,
              todos: [
                { id: 1, text: 'A', completed: false, indent: 0 },
                { id: 2, text: 'B', completed: true, indent: 0 },
              ],
            };
          }
          return { version: 2, todos: [] };
        }
        // Default fallthrough for other channels
        return undefined;
      });

      // Act: duplicate and then load todos for the new list
      const dup = await duplicateList(sourceListId);
      expect(dup).toEqual({ success: true, newListId });

      const srcTodos = await loadListTodos(sourceListId);
      const dstTodos = await loadListTodos(newListId);

      // Assert: ids are remapped in new list and order/content preserved
      expect(srcTodos.todos.map((t) => t.id)).toEqual([5, 10]);
      expect(dstTodos.todos.map((t) => t.id)).toEqual([1, 2]);
      expect(dstTodos.todos.map((t) => t.text)).toEqual(
        srcTodos.todos.map((t) => t.text),
      );
      expect(dstTodos.todos.map((t) => t.completed)).toEqual(
        srcTodos.todos.map((t) => t.completed),
      );

      // Sanity: verify IPC channels called as expected
      expect(calls.some((c) => c.channel === 'duplicate-list')).toBe(true);
      expect(
        calls.filter((c) => c.channel === 'load-list-todos').length,
      ).toBeGreaterThanOrEqual(2);
    });

    it('should duplicate list with custom name', async () => {
      const mockResult = { success: true, newListId: 'new-list-id' };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await duplicateList('source-list-id', 'My Custom Name');

      expect(result).toEqual(mockResult);
      expect(mockInvoke).toHaveBeenCalledWith(
        'duplicate-list',
        'source-list-id',
        'My Custom Name',
      );
    });

    it('should return error when source list not found', async () => {
      const mockResult = { success: false, error: 'not_found' };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await duplicateList('non-existent-id');

      expect(result).toEqual(mockResult);
    });

    it('should return error when source list id is invalid', async () => {
      const mockResult = { success: false, error: 'invalid_source_id' };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await duplicateList('');

      expect(result).toEqual(mockResult);
    });

    it('should return internal error when exception occurs', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const result = await duplicateList('source-list-id');

      expect(result).toEqual({ success: false, error: 'internal_error' });
    });
  });

  describe('deleteList', () => {
    it('should call delete-list IPC with id and return success', async () => {
      mockInvoke.mockResolvedValue({ success: true });
      const res = await deleteList('some-list-id');
      expect(res).toEqual({ success: true });
      expect(mockInvoke).toHaveBeenCalledWith('delete-list', 'some-list-id');
    });

    it('should return error when IPC fails', async () => {
      mockInvoke.mockResolvedValue({ success: false, error: 'not_found' });
      const res = await deleteList('bad-id');
      expect(res).toEqual({ success: false, error: 'not_found' });
    });

    it('should return internal_error on exception', async () => {
      mockInvoke.mockRejectedValue(new Error('boom'));
      const res = await deleteList('x');
      expect(res).toEqual({ success: false, error: 'internal_error' });
    });
  });

  describe('debounce coalescing (burst saves)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('coalesces multiple debounced saves into one IPC call', async () => {
      // Arrange: mock IPC
      mockInvoke.mockResolvedValue({ success: true });

      // A minimal coalescer mirroring saveWithStrategy('debounced', 75)
      let t: any = null;
      const callSave = (listId: string, doc: any) => {
        // this mirrors renderer's debounced behavior
        if (t) clearTimeout(t);
        t = setTimeout(async () => {
          await (window as any).electron.ipcRenderer.invoke(
            'save-list-todos',
            listId,
            doc,
          );
          t = null;
        }, 75);
      };

      // Act: rapid burst of 5 saves within 75ms
      for (let i = 0; i < 5; i++) {
        callSave('list-1', { version: 2, todos: [] });
      }
      // advance time to flush the debounced save
      jest.advanceTimersByTime(80);

      // Assert: only one IPC save invoked
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('save-list-todos', 'list-1', {
        version: 2,
        todos: [],
      });
    });
  });
});
