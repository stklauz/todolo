import {
  computeSectionById,
  isChildOf,
  groupTodosBySection,
  computeIndeterminateState,
} from '../todoUtils';
import type { EditorTodo } from '../../types';

describe('enhanced todoUtils', () => {
  describe('computeSectionById', () => {
    it('should return active for uncompleted parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(computeSectionById(1, todos)).toBe('active');
    });

    it('should return active for completed parent with uncompleted child', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(computeSectionById(1, todos)).toBe('active');
    });

    it('should return completed for completed parent with all children completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child 1', completed: true, indent: 1 },
        { id: 3, text: 'Child 2', completed: true, indent: 1 },
      ];

      expect(computeSectionById(1, todos)).toBe('completed');
    });

    it('should return active for child when parent is not completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: true, indent: 1 },
      ];

      expect(computeSectionById(2, todos)).toBe('active');
    });

    it('should return completed for child when both parent and child are completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child', completed: true, indent: 1 },
      ];

      expect(computeSectionById(2, todos)).toBe('completed');
    });

    it('should return active for non-existent todo', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo', completed: false, indent: 0 },
      ];

      expect(computeSectionById(999, todos)).toBe('active');
    });
  });

  describe('isChildOf', () => {
    it('should return true for direct child relationship', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(true);
    });

    it('should return true for nested child relationship', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
        { id: 4, text: 'Grandchild', completed: false, indent: 1 },
      ];

      expect(isChildOf(1, 4, todos)).toBe(true);
    });

    it('should return false for same todo', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
      ];

      expect(isChildOf(1, 1, todos)).toBe(false);
    });

    it('should return false for parent-child relationship with different completion status', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: true, indent: 1 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(false);
    });

    it('should return false when target comes before source', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(isChildOf(2, 1, todos)).toBe(false);
    });

    it('should return false when target is not indented more than source', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Sibling', completed: false, indent: 0 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(false);
    });

    it('should return false when relationship is broken by intermediate todo', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent 1', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Parent 2', completed: false, indent: 0 },
        { id: 4, text: 'Child 2', completed: false, indent: 1 },
      ];

      expect(isChildOf(1, 4, todos)).toBe(false);
    });

    it('should return false for non-existent todos', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo', completed: false, indent: 0 },
      ];

      expect(isChildOf(999, 1, todos)).toBe(false);
      expect(isChildOf(1, 999, todos)).toBe(false);
    });
  });

  describe('groupTodosBySection', () => {
    it('should group todos correctly by section', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Active Parent', completed: false, indent: 0 },
        { id: 2, text: 'Active Child', completed: false, indent: 1 },
        { id: 3, text: 'Completed Parent', completed: true, indent: 0 },
        { id: 4, text: 'Completed Child', completed: true, indent: 1 },
      ];

      const result = groupTodosBySection(todos);

      expect(result.active).toHaveLength(2);
      expect(result.completed).toHaveLength(2);
      expect(result.active.map((t) => t.id)).toEqual([1, 2]);
      expect(result.completed.map((t) => t.id)).toEqual([3, 4]);
    });

    it('should handle mixed completion states correctly', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child 1', completed: true, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = groupTodosBySection(todos);

      // Parent should be active because not all children are completed
      expect(result.active.map((t) => t.id)).toEqual([1, 3]);
      expect(result.completed.map((t) => t.id)).toEqual([2]);
    });

    it('should handle empty todos array', () => {
      const result = groupTodosBySection([]);

      expect(result.active).toEqual([]);
      expect(result.completed).toEqual([]);
      expect(result.indeterminate.size).toBe(0);
      expect(result.section.size).toBe(0);
    });
  });

  describe('computeIndeterminateState', () => {
    it('should mark parent as indeterminate when some children are completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: true, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = computeIndeterminateState(todos);

      expect(result.get(1)).toBe(true);
      expect(result.get(2)).toBe(false);
      expect(result.get(3)).toBe(false);
    });

    it('should not mark parent as indeterminate when all children are completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: true, indent: 1 },
        { id: 3, text: 'Child 2', completed: true, indent: 1 },
      ];

      const result = computeIndeterminateState(todos);

      expect(result.get(1)).toBe(false);
    });

    it('should not mark parent as indeterminate when no children are completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = computeIndeterminateState(todos);

      expect(result.get(1)).toBe(false);
    });

    it('should never mark children as indeterminate', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: true, indent: 1 },
      ];

      const result = computeIndeterminateState(todos);

      expect(result.get(2)).toBe(false);
    });
  });
});
