import {
  createNewTodo,
  computeSectionById,
  isChildOf,
  groupTodosBySection,
  computeIndeterminateState,
  deriveIndentFromParentId,
} from '../todoUtils';

import type { EditorTodo } from '../../types';

describe('todoUtils.createNewTodo defaults', () => {
  test('sets parentId=null and section=active by default', () => {
    const todo = createNewTodo('hello', 1);
    expect((todo as any).parentId).toBeNull();
    expect((todo as any).section).toBe('active');
  });

  test('indent remains a rendering concern and is clamped', () => {
    const low = createNewTodo('low', 2, -10);
    const high = createNewTodo('high', 3, 999);
    expect(low.indent).toBeGreaterThanOrEqual(0);
    expect(high.indent).toBeLessThanOrEqual(1);
  });
});

describe('deriveIndentFromParentId', () => {
  it('should return 0 for top-level todo (parentId === null)', () => {
    const todo: EditorTodo = {
      id: 1,
      text: 'Top-level',
      completed: false,
      parentId: null,
    };
    expect(deriveIndentFromParentId(todo)).toBe(0);
  });

  it('should return 1 for child todo (parentId !== null)', () => {
    const todo: EditorTodo = {
      id: 2,
      text: 'Child',
      completed: false,
      parentId: 1,
    };
    expect(deriveIndentFromParentId(todo)).toBe(1);
  });

  it('should return 0 when parentId is undefined (treats as null)', () => {
    const todo: EditorTodo = {
      id: 3,
      text: 'Undefined parent',
      completed: false,
      parentId: undefined as any,
    };
    expect(deriveIndentFromParentId(todo)).toBe(0);
  });

  it('should ignore existing indent field (parentId is source of truth)', () => {
    const todoWithIndent1: EditorTodo = {
      id: 4,
      text: 'Mismatched indent',
      completed: false,
      parentId: null,
      indent: 1, // This should be ignored
    };
    expect(deriveIndentFromParentId(todoWithIndent1)).toBe(0);

    const todoWithIndent0: EditorTodo = {
      id: 5,
      text: 'Child with indent 0',
      completed: false,
      parentId: 1,
      indent: 0, // This should be ignored
    };
    expect(deriveIndentFromParentId(todoWithIndent0)).toBe(1);
  });
});

describe('enhanced todoUtils', () => {
  describe('computeSectionById', () => {
    it('should return active for uncompleted parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: false, indent: 1, parentId: 1 },
      ];

      expect(computeSectionById(1, todos)).toBe('active');
    });

    it('should return active for completed parent with uncompleted child', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: false, indent: 1, parentId: 1 },
      ];

      expect(computeSectionById(1, todos)).toBe('active');
    });

    it('should return completed for completed parent with all children completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0, parentId: null },
        { id: 2, text: 'Child 1', completed: true, indent: 1, parentId: 1 },
        { id: 3, text: 'Child 2', completed: true, indent: 1, parentId: 1 },
      ];

      expect(computeSectionById(1, todos)).toBe('completed');
    });

    it('should return active for child when parent is not completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: true, indent: 1, parentId: 1 },
      ];

      expect(computeSectionById(2, todos)).toBe('active');
    });

    it('should return completed for child when both parent and child are completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: true, indent: 1, parentId: 1 },
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
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: false, indent: 1, parentId: 1 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(true);
    });

    it('should return true for nested child relationship', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child 1', completed: false, indent: 1, parentId: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1, parentId: 1 },
        { id: 4, text: 'Grandchild', completed: false, indent: 1, parentId: 2 },
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
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: true, indent: 1, parentId: 1 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(false);
    });

    it('should return false when target comes before source', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: false, indent: 1, parentId: 1 },
      ];

      expect(isChildOf(2, 1, todos)).toBe(false);
    });

    it('should return false when target is not a descendant', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Sibling', completed: false, indent: 0, parentId: null },
      ];

      expect(isChildOf(1, 2, todos)).toBe(false);
    });

    it('should return false when relationship is broken by different parent', () => {
      const todos: EditorTodo[] = [
        {
          id: 1,
          text: 'Parent 1',
          completed: false,
          indent: 0,
          parentId: null,
        },
        { id: 2, text: 'Child 1', completed: false, indent: 1, parentId: 1 },
        {
          id: 3,
          text: 'Parent 2',
          completed: false,
          indent: 0,
          parentId: null,
        },
        { id: 4, text: 'Child 2', completed: false, indent: 1, parentId: 3 },
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
        {
          id: 1,
          text: 'Active Parent',
          completed: false,
          indent: 0,
          parentId: null,
        },
        {
          id: 2,
          text: 'Active Child',
          completed: false,
          indent: 1,
          parentId: 1,
        },
        {
          id: 3,
          text: 'Completed Parent',
          completed: true,
          indent: 0,
          parentId: null,
        },
        {
          id: 4,
          text: 'Completed Child',
          completed: true,
          indent: 1,
          parentId: 3,
        },
      ];

      const result = groupTodosBySection(todos);

      expect(result.active).toHaveLength(2);
      expect(result.completed).toHaveLength(2);
      expect(result.active.map((t) => t.id)).toEqual([1, 2]);
      expect(result.completed.map((t) => t.id)).toEqual([3, 4]);
    });

    it('should handle mixed completion states correctly', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0, parentId: null },
        { id: 2, text: 'Child 1', completed: true, indent: 1, parentId: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1, parentId: 1 },
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
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child 1', completed: true, indent: 1, parentId: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1, parentId: 1 },
      ];

      const result = computeIndeterminateState(todos);

      expect(result.get(1)).toBe(true);
      expect(result.get(2)).toBe(false);
      expect(result.get(3)).toBe(false);
    });

    it('should not mark parent as indeterminate when all children are completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child 1', completed: true, indent: 1, parentId: 1 },
        { id: 3, text: 'Child 2', completed: true, indent: 1, parentId: 1 },
      ];

      const result = computeIndeterminateState(todos);

      expect(result.get(1)).toBe(false);
    });

    it('should not mark parent as indeterminate when no children are completed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child 1', completed: false, indent: 1, parentId: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1, parentId: 1 },
      ];

      const result = computeIndeterminateState(todos);

      expect(result.get(1)).toBe(false);
    });

    it('should never mark children as indeterminate', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
        { id: 2, text: 'Child', completed: true, indent: 1, parentId: 1 },
      ];

      const result = computeIndeterminateState(todos);

      expect(result.get(2)).toBe(false);
    });
  });
});
