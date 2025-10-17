import { todosReducer, todosActions } from '../todosReducer';
import type { EditorTodo } from '../../types';

const initialState = {
  todos: [],
  nextId: 1,
};

describe('todosReducer', () => {
  it('should return initial state', () => {
    expect(todosReducer(initialState, { type: 'UNKNOWN' } as any)).toEqual(
      initialState,
    );
  });

  describe('ADD_TODO', () => {
    it('should add a new todo', () => {
      const action = todosActions.addTodo('Test todo');
      const result = todosReducer(initialState, action);

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0]).toEqual({
        id: 1,
        text: 'Test todo',
        completed: false,
        indent: 0,
      });
      expect(result.nextId).toBe(2);
    });

    it('should add a todo with custom indent', () => {
      const action = todosActions.addTodo('Test todo', 1);
      const result = todosReducer(initialState, action);

      expect(result.todos[0].indent).toBe(1);
    });
  });

  describe('UPDATE_TODO', () => {
    it('should update todo text', () => {
      const state = {
        todos: [{ id: 1, text: 'Original', completed: false, indent: 0 }],
        nextId: 2,
      };
      const action = todosActions.updateTodo(1, 'Updated');
      const result = todosReducer(state, action);

      expect(result.todos[0].text).toBe('Updated');
      expect(result.todos[0].completed).toBe(false);
      expect(result.todos[0].indent).toBe(0);
    });

    it('should not update non-existent todo', () => {
      const state = {
        todos: [{ id: 1, text: 'Original', completed: false, indent: 0 }],
        nextId: 2,
      };
      const action = todosActions.updateTodo(999, 'Updated');
      const result = todosReducer(state, action);

      expect(result.todos[0].text).toBe('Original');
    });
  });

  describe('TOGGLE_TODO', () => {
    it('should toggle todo completion', () => {
      const state = {
        todos: [{ id: 1, text: 'Test', completed: false, indent: 0 }],
        nextId: 2,
      };
      const action = todosActions.toggleTodo(1);
      const result = todosReducer(state, action);

      expect(result.todos[0].completed).toBe(true);
    });

    it('should toggle parent and all children', () => {
      const state = {
        todos: [
          { id: 1, text: 'Parent', completed: false, indent: 0 },
          { id: 2, text: 'Child 1', completed: false, indent: 1 },
          { id: 3, text: 'Child 2', completed: false, indent: 1 },
          { id: 4, text: 'Other Parent', completed: false, indent: 0 },
        ],
        nextId: 5,
      };
      const action = todosActions.toggleTodo(1);
      const result = todosReducer(state, action);

      expect(result.todos[0].completed).toBe(true);
      expect(result.todos[1].completed).toBe(true);
      expect(result.todos[2].completed).toBe(true);
      expect(result.todos[3].completed).toBe(false); // Other parent unchanged
    });

    it('should not affect non-existent todo', () => {
      const state = {
        todos: [{ id: 1, text: 'Test', completed: false, indent: 0 }],
        nextId: 2,
      };
      const action = todosActions.toggleTodo(999);
      const result = todosReducer(state, action);

      expect(result.todos[0].completed).toBe(false);
    });
  });

  describe('DELETE_TODO', () => {
    it('should delete todo by id', () => {
      const state = {
        todos: [
          { id: 1, text: 'Keep', completed: false, indent: 0 },
          { id: 2, text: 'Delete', completed: false, indent: 0 },
        ],
        nextId: 3,
      };
      const action = todosActions.deleteTodo(2);
      const result = todosReducer(state, action);

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].id).toBe(1);
    });
  });

  describe('CHANGE_INDENT', () => {
    it('should increase indent', () => {
      const state = {
        todos: [{ id: 1, text: 'Test', completed: false, indent: 0 }],
        nextId: 2,
      };
      const action = todosActions.changeIndent(1, 1);
      const result = todosReducer(state, action);

      expect(result.todos[0].indent).toBe(1);
    });

    it('should decrease indent', () => {
      const state = {
        todos: [{ id: 1, text: 'Test', completed: false, indent: 1 }],
        nextId: 2,
      };
      const action = todosActions.changeIndent(1, -1);
      const result = todosReducer(state, action);

      expect(result.todos[0].indent).toBe(0);
    });

    it('should clamp indent to valid range', () => {
      const state = {
        todos: [{ id: 1, text: 'Test', completed: false, indent: 0 }],
        nextId: 2,
      };
      const action = todosActions.changeIndent(1, 5);
      const result = todosReducer(state, action);

      expect(result.todos[0].indent).toBe(1); // Clamped to max
    });
  });

  describe('SET_INDENT', () => {
    it('should set specific indent level', () => {
      const state = {
        todos: [{ id: 1, text: 'Test', completed: false, indent: 0 }],
        nextId: 2,
      };
      const action = todosActions.setIndent(1, 1);
      const result = todosReducer(state, action);

      expect(result.todos[0].indent).toBe(1);
    });
  });

  describe('REORDER_TODOS', () => {
    it('should replace todos array', () => {
      const state = {
        todos: [
          { id: 1, text: 'First', completed: false, indent: 0 },
          { id: 2, text: 'Second', completed: false, indent: 0 },
        ],
        nextId: 3,
      };
      const newTodos = [
        { id: 2, text: 'Second', completed: false, indent: 0 },
        { id: 1, text: 'First', completed: false, indent: 0 },
      ];
      const action = todosActions.reorderTodos(newTodos);
      const result = todosReducer(state, action);

      expect(result.todos).toEqual(newTodos);
    });
  });

  describe('SET_TODOS', () => {
    it('should set todos and update nextId', () => {
      const state = {
        todos: [],
        nextId: 1,
      };
      const newTodos = [
        { id: 5, text: 'Test 1', completed: false, indent: 0 },
        { id: 10, text: 'Test 2', completed: false, indent: 0 },
      ];
      const action = todosActions.setTodos(newTodos);
      const result = todosReducer(state, action);

      expect(result.todos).toEqual(newTodos);
      expect(result.nextId).toBe(11); // maxId + 1
    });
  });
});
