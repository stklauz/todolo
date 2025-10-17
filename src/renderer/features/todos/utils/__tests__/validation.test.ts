import {
  normalizeTodo,
  normalizeList,
  isValidTodoId,
  isValidListId,
  isValidTodoText,
  isValidListName,
  validateAndNormalizeTodo,
  validateAndNormalizeList,
} from '../validation';
import type { EditorTodo, TodoList } from '../../types';

describe('validation utilities', () => {
  describe('normalizeTodo', () => {
    it('should normalize a valid todo object', () => {
      const input = { id: 1, text: 'Test todo', completed: true, indent: 1 };
      const result = normalizeTodo(input);

      expect(result).toEqual({
        id: 1,
        text: 'Test todo',
        completed: true,
        indent: 1,
      });
    });

    it('should handle missing properties with defaults', () => {
      const input = { id: 2, text: 'Test' };
      const result = normalizeTodo(input);

      expect(result).toEqual({
        id: 2,
        text: 'Test',
        completed: false,
        indent: 0,
      });
    });

    it('should use fallback ID when id is invalid', () => {
      const input = { text: 'Test' };
      const result = normalizeTodo(input, 5);

      expect(result.id).toBe(5);
    });

    it('should clamp indent to valid range', () => {
      const input = { id: 1, text: 'Test', indent: 5 };
      const result = normalizeTodo(input);

      expect(result.indent).toBe(1);
    });

    it('should handle negative indent', () => {
      const input = { id: 1, text: 'Test', indent: -2 };
      const result = normalizeTodo(input);

      expect(result.indent).toBe(0);
    });

    it('should handle checked property as completed', () => {
      const input = { id: 1, text: 'Test', checked: true };
      const result = normalizeTodo(input);

      expect(result.completed).toBe(true);
    });
  });

  describe('normalizeList', () => {
    it('should normalize a valid list object', () => {
      const input = {
        id: 'list-1',
        name: 'My List',
        todos: [{ id: 1, text: 'Todo 1' }],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      };
      const result = normalizeList(input);

      expect(result).toEqual({
        id: 'list-1',
        name: 'My List',
        todos: [{ id: 1, text: 'Todo 1', completed: false, indent: 0 }],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      });
    });

    it('should handle missing properties with defaults', () => {
      const input = { id: 'list-1', name: 'My List' };
      const result = normalizeList(input);

      expect(result).toEqual({
        id: 'list-1',
        name: 'My List',
        todos: [],
        createdAt: expect.any(String),
        updatedAt: undefined,
      });
    });

    it('should use fallback index for name when name is invalid', () => {
      const input = { id: 'list-1' };
      const result = normalizeList(input, 2);

      expect(result.name).toBe('List 3');
    });
  });

  describe('validation functions', () => {
    describe('isValidTodoId', () => {
      it('should return true for valid todo IDs', () => {
        expect(isValidTodoId(1)).toBe(true);
        expect(isValidTodoId(42)).toBe(true);
      });

      it('should return false for invalid todo IDs', () => {
        expect(isValidTodoId(0)).toBe(false);
        expect(isValidTodoId(-1)).toBe(false);
        expect(isValidTodoId(1.5)).toBe(false);
        expect(isValidTodoId('1')).toBe(false);
        expect(isValidTodoId(null)).toBe(false);
        expect(isValidTodoId(undefined)).toBe(false);
      });
    });

    describe('isValidListId', () => {
      it('should return true for valid list IDs', () => {
        expect(isValidListId('list-1')).toBe(true);
        expect(isValidListId('abc123')).toBe(true);
      });

      it('should return false for invalid list IDs', () => {
        expect(isValidListId('')).toBe(false);
        expect(isValidListId(1)).toBe(false);
        expect(isValidListId(null)).toBe(false);
        expect(isValidListId(undefined)).toBe(false);
      });
    });

    describe('isValidTodoText', () => {
      it('should return true for non-empty text', () => {
        expect(isValidTodoText('Hello')).toBe(true);
        expect(isValidTodoText('  Hello  ')).toBe(true);
      });

      it('should return false for empty text', () => {
        expect(isValidTodoText('')).toBe(false);
        expect(isValidTodoText('   ')).toBe(false);
        expect(isValidTodoText('\t\n')).toBe(false);
      });
    });

    describe('isValidListName', () => {
      it('should return true for non-empty names', () => {
        expect(isValidListName('My List')).toBe(true);
        expect(isValidListName('  My List  ')).toBe(true);
      });

      it('should return false for empty names', () => {
        expect(isValidListName('')).toBe(false);
        expect(isValidListName('   ')).toBe(false);
        expect(isValidListName('\t\n')).toBe(false);
      });
    });
  });

  describe('validateAndNormalizeTodo', () => {
    it('should return valid result for good input', () => {
      const input = { id: 1, text: 'Test', completed: true };
      const result = validateAndNormalizeTodo(input);

      expect(result.valid).toBe(true);
      expect((result as any).data).toEqual({
        id: 1,
        text: 'Test',
        completed: true,
        indent: 0,
      });
    });

    it('should return error for invalid input', () => {
      const result = validateAndNormalizeTodo(null);

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('Todo must be an object');
    });

    it('should return error for invalid ID', () => {
      const input = { id: 'invalid', text: 'Test' };
      const result = validateAndNormalizeTodo(input, undefined); // Don't provide fallback

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('Invalid todo ID');
    });
  });

  describe('validateAndNormalizeList', () => {
    it('should return valid result for good input', () => {
      const input = { id: 'list-1', name: 'My List', todos: [] };
      const result = validateAndNormalizeList(input);

      expect(result.valid).toBe(true);
      expect((result as any).data.id).toBe('list-1');
      expect((result as any).data.name).toBe('My List');
      expect((result as any).data.todos).toEqual([]);
    });

    it('should return error for invalid input', () => {
      const result = validateAndNormalizeList(null);

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('List must be an object');
    });

    it('should return error for invalid ID', () => {
      const input = { id: '', name: 'My List' };
      const result = validateAndNormalizeList(input);

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('Invalid list ID');
    });

    it('should return error for invalid name', () => {
      const input = { id: 'list-1', name: '' };
      const result = validateAndNormalizeList(input);

      expect(result.valid).toBe(false);
      expect((result as any).error).toBe('Invalid list name');
    });
  });
});
