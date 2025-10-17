import type { TodoList } from '../types';

// Action types for lists reducer
export type ListsAction =
  | {
      type: 'ADD_LIST';
      payload: { id: string; name: string; createdAt: string };
    }
  | { type: 'DELETE_LIST'; payload: { id: string } }
  | { type: 'RENAME_LIST'; payload: { id: string; name: string } }
  | { type: 'DUPLICATE_LIST'; payload: { newList: TodoList } }
  | { type: 'SET_LISTS'; payload: { lists: TodoList[] } }
  | { type: 'UPDATE_LIST_TODOS'; payload: { id: string; todos: any[] } }
  | { type: 'UPDATE_LIST_TIMESTAMP'; payload: { id: string } };

export interface ListsState {
  lists: TodoList[];
  selectedListId: string | null;
}

// const initialState: ListsState = {
//   lists: [],
//   selectedListId: null,
// };

export function listsReducer(
  state: ListsState,
  action: ListsAction,
): ListsState {
  switch (action.type) {
    case 'ADD_LIST': {
      const { id, name, createdAt } = action.payload;
      const newList: TodoList = {
        id,
        name,
        todos: [],
        createdAt,
        updatedAt: createdAt,
      };
      return {
        lists: [...state.lists, newList],
        selectedListId: id,
      };
    }

    case 'DELETE_LIST': {
      const { id } = action.payload;
      const remainingLists = state.lists.filter((list) => list.id !== id);
      const nextSelectedId =
        state.selectedListId === id
          ? (remainingLists[0]?.id ?? null)
          : state.selectedListId;

      return {
        lists: remainingLists,
        selectedListId: nextSelectedId,
      };
    }

    case 'RENAME_LIST': {
      const { id, name } = action.payload;
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === id
            ? { ...list, name, updatedAt: new Date().toISOString() }
            : list,
        ),
      };
    }

    case 'DUPLICATE_LIST': {
      const { newList } = action.payload;
      return {
        lists: [...state.lists, newList],
        selectedListId: newList.id,
      };
    }

    case 'SET_LISTS': {
      const { lists } = action.payload;
      return {
        lists,
        selectedListId: state.selectedListId || lists[0]?.id || null,
      };
    }

    case 'UPDATE_LIST_TODOS': {
      const { id, todos } = action.payload;
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === id
            ? { ...list, todos, updatedAt: new Date().toISOString() }
            : list,
        ),
      };
    }

    case 'UPDATE_LIST_TIMESTAMP': {
      const { id } = action.payload;
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === id
            ? { ...list, updatedAt: new Date().toISOString() }
            : list,
        ),
      };
    }

    default:
      return state;
  }
}

// Action creators
export const listsActions = {
  addList: (id: string, name: string, createdAt: string): ListsAction => ({
    type: 'ADD_LIST',
    payload: { id, name, createdAt },
  }),

  deleteList: (id: string): ListsAction => ({
    type: 'DELETE_LIST',
    payload: { id },
  }),

  renameList: (id: string, name: string): ListsAction => ({
    type: 'RENAME_LIST',
    payload: { id, name },
  }),

  duplicateList: (newList: TodoList): ListsAction => ({
    type: 'DUPLICATE_LIST',
    payload: { newList },
  }),

  setLists: (lists: TodoList[]): ListsAction => ({
    type: 'SET_LISTS',
    payload: { lists },
  }),

  updateListTodos: (id: string, todos: any[]): ListsAction => ({
    type: 'UPDATE_LIST_TODOS',
    payload: { id, todos },
  }),

  updateListTimestamp: (id: string): ListsAction => ({
    type: 'UPDATE_LIST_TIMESTAMP',
    payload: { id },
  }),
};
