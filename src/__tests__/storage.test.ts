import {
  loadListsIndex,
  saveListsIndex,
  loadListTodos,
  saveListTodos,
  duplicateList,
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
});
