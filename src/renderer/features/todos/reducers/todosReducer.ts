import type { EditorTodo } from '../types';
import {
  createNewTodo,
  updateTodoText,
  // toggleTodoCompletion,
  updateTodoIndent,
} from '../utils/todoUtils';

// Action types for todos reducer
export type TodosAction =
  | { type: 'ADD_TODO'; payload: { text: string; indent?: number } }
  | { type: 'UPDATE_TODO'; payload: { id: number; text: string } }
  | { type: 'TOGGLE_TODO'; payload: { id: number } }
  | { type: 'DELETE_TODO'; payload: { id: number } }
  | { type: 'CHANGE_INDENT'; payload: { id: number; delta: number } }
  | { type: 'SET_INDENT'; payload: { id: number; indent: number } }
  | { type: 'REORDER_TODOS'; payload: { todos: EditorTodo[] } }
  | { type: 'SET_TODOS'; payload: { todos: EditorTodo[] } };

export interface TodosState {
  todos: EditorTodo[];
  nextId: number;
}

// const initialState: TodosState = {
//   todos: [],
//   nextId: 1,
// };

export function todosReducer(
  state: TodosState,
  action: TodosAction,
): TodosState {
  switch (action.type) {
    case 'ADD_TODO': {
      const { text, indent = 0 } = action.payload;
      const newTodo = createNewTodo(text, state.nextId, indent);
      return {
        todos: [...state.todos, newTodo],
        nextId: state.nextId + 1,
      };
    }

    case 'UPDATE_TODO': {
      const { id, text } = action.payload;
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === id ? updateTodoText(todo, text) : todo,
        ),
      };
    }

    case 'TOGGLE_TODO': {
      const { id } = action.payload;
      const todoIndex = state.todos.findIndex((t) => t.id === id);
      if (todoIndex === -1) return state;

      const todo = state.todos[todoIndex];
      const newCompleted = !todo.completed;
      const newTodos = [...state.todos];

      // Update the todo
      newTodos[todoIndex] = { ...todo, completed: newCompleted };

      // If toggling a parent (indent 0), apply to all consecutive children
      if (todo.indent === 0) {
        for (let i = todoIndex + 1; i < newTodos.length; i++) {
          if (newTodos[i].indent === 0) break; // Stop at next parent
          newTodos[i] = { ...newTodos[i], completed: newCompleted };
        }
      }

      return {
        ...state,
        todos: newTodos,
      };
    }

    case 'DELETE_TODO': {
      const { id } = action.payload;
      return {
        ...state,
        todos: state.todos.filter((todo) => todo.id !== id),
      };
    }

    case 'CHANGE_INDENT': {
      const { id, delta } = action.payload;
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === id
            ? updateTodoIndent(todo, (todo.indent ?? 0) + delta)
            : todo,
        ),
      };
    }

    case 'SET_INDENT': {
      const { id, indent } = action.payload;
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === id ? updateTodoIndent(todo, indent) : todo,
        ),
      };
    }

    case 'REORDER_TODOS': {
      return {
        ...state,
        todos: action.payload.todos,
      };
    }

    case 'SET_TODOS': {
      const maxId = action.payload.todos.reduce(
        (max, todo) => Math.max(max, todo.id),
        0,
      );
      return {
        todos: action.payload.todos,
        nextId: maxId + 1,
      };
    }

    default:
      return state;
  }
}

// Action creators
export const todosActions = {
  addTodo: (text: string, indent?: number): TodosAction => ({
    type: 'ADD_TODO',
    payload: { text, indent },
  }),

  updateTodo: (id: number, text: string): TodosAction => ({
    type: 'UPDATE_TODO',
    payload: { id, text },
  }),

  toggleTodo: (id: number): TodosAction => ({
    type: 'TOGGLE_TODO',
    payload: { id },
  }),

  deleteTodo: (id: number): TodosAction => ({
    type: 'DELETE_TODO',
    payload: { id },
  }),

  changeIndent: (id: number, delta: number): TodosAction => ({
    type: 'CHANGE_INDENT',
    payload: { id, delta },
  }),

  setIndent: (id: number, indent: number): TodosAction => ({
    type: 'SET_INDENT',
    payload: { id, indent },
  }),

  reorderTodos: (todos: EditorTodo[]): TodosAction => ({
    type: 'REORDER_TODOS',
    payload: { todos },
  }),

  setTodos: (todos: EditorTodo[]): TodosAction => ({
    type: 'SET_TODOS',
    payload: { todos },
  }),
};
