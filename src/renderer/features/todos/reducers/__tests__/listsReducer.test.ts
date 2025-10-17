import { listsReducer, listsActions } from '../listsReducer';
import type { TodoList } from '../../types';

const initialState = {
  lists: [],
  selectedListId: null,
};

describe('listsReducer', () => {
  it('should return initial state', () => {
    expect(listsReducer(initialState, { type: 'UNKNOWN' } as any)).toEqual(
      initialState,
    );
  });

  describe('ADD_LIST', () => {
    it('should add a new list and select it', () => {
      const action = listsActions.addList(
        'list-1',
        'My List',
        '2023-01-01T00:00:00.000Z',
      );
      const result = listsReducer(initialState, action);

      expect(result.lists).toHaveLength(1);
      expect(result.lists[0]).toEqual({
        id: 'list-1',
        name: 'My List',
        todos: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      });
      expect(result.selectedListId).toBe('list-1');
    });
  });

  describe('DELETE_LIST', () => {
    it('should delete list and select first remaining', () => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'List 1',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'list-2',
            name: 'List 2',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'list-1',
      };
      const action = listsActions.deleteList('list-1');
      const result = listsReducer(state, action);

      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].id).toBe('list-2');
      expect(result.selectedListId).toBe('list-2');
    });

    it('should set selectedListId to null if no lists remain', () => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'List 1',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'list-1',
      };
      const action = listsActions.deleteList('list-1');
      const result = listsReducer(state, action);

      expect(result.lists).toHaveLength(0);
      expect(result.selectedListId).toBe(null);
    });

    it('should not change selectedListId if deleting different list', () => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'List 1',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'list-2',
            name: 'List 2',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'list-1',
      };
      const action = listsActions.deleteList('list-2');
      const result = listsReducer(state, action);

      expect(result.lists).toHaveLength(1);
      expect(result.selectedListId).toBe('list-1');
    });
  });

  describe('RENAME_LIST', () => {
    it('should rename list and update timestamp', () => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'Old Name',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'list-1',
      };
      const action = listsActions.renameList('list-1', 'New Name');
      const result = listsReducer(state, action);

      expect(result.lists[0].name).toBe('New Name');
      expect(result.lists[0].updatedAt).toBeDefined();
      expect(result.lists[0].updatedAt).not.toBe('2023-01-01T00:00:00.000Z');
    });

    it('should not affect other lists', () => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'List 1',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'list-2',
            name: 'List 2',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'list-1',
      };
      const action = listsActions.renameList('list-1', 'New Name');
      const result = listsReducer(state, action);

      expect(result.lists[1].name).toBe('List 2');
    });
  });

  describe('DUPLICATE_LIST', () => {
    it('should add duplicated list and select it', () => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'Original',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'list-1',
      };
      const newList: TodoList = {
        id: 'list-2',
        name: 'Original (Copy)',
        todos: [],
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      };
      const action = listsActions.duplicateList(newList);
      const result = listsReducer(state, action);

      expect(result.lists).toHaveLength(2);
      expect(result.lists[1]).toEqual(newList);
      expect(result.selectedListId).toBe('list-2');
    });
  });

  describe('SET_LISTS', () => {
    it('should set lists and select first if no current selection', () => {
      const state = {
        lists: [],
        selectedListId: null,
      };
      const newLists = [
        {
          id: 'list-1',
          name: 'List 1',
          todos: [],
          createdAt: '2023-01-01T00:00:00.000Z',
        },
        {
          id: 'list-2',
          name: 'List 2',
          todos: [],
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      ];
      const action = listsActions.setLists(newLists);
      const result = listsReducer(state, action);

      expect(result.lists).toEqual(newLists);
      expect(result.selectedListId).toBe('list-1');
    });

    it('should preserve current selection if it exists', () => {
      const state = {
        lists: [],
        selectedListId: 'list-2',
      };
      const newLists = [
        {
          id: 'list-1',
          name: 'List 1',
          todos: [],
          createdAt: '2023-01-01T00:00:00.000Z',
        },
        {
          id: 'list-2',
          name: 'List 2',
          todos: [],
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      ];
      const action = listsActions.setLists(newLists);
      const result = listsReducer(state, action);

      expect(result.lists).toEqual(newLists);
      expect(result.selectedListId).toBe('list-2');
    });
  });

  describe('UPDATE_LIST_TODOS', () => {
    it('should update todos for specific list', () => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'List 1',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'list-2',
            name: 'List 2',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'list-1',
      };
      const newTodos = [
        { id: 1, text: 'New Todo', completed: false, indent: 0 },
      ];
      const action = listsActions.updateListTodos('list-1', newTodos);
      const result = listsReducer(state, action);

      expect(result.lists[0].todos).toEqual(newTodos);
      expect(result.lists[0].updatedAt).toBeDefined();
      expect(result.lists[1].todos).toEqual([]); // Unchanged
    });
  });

  describe('UPDATE_LIST_TIMESTAMP', () => {
    it('should update timestamp for specific list', () => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'List 1',
            todos: [],
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        selectedListId: 'list-1',
      };
      const action = listsActions.updateListTimestamp('list-1');
      const result = listsReducer(state, action);

      expect(result.lists[0].updatedAt).toBeDefined();
      expect(result.lists[0].updatedAt).not.toBe('2023-01-01T00:00:00.000Z');
    });
  });
});
