import {
  isChildOf,
  computeSection,
  extractTodoBlock,
  insertTodoBlock,
  removeTodoBlock,
  fixOrphanedChildren,
  findLastIndexInSection,
  validateDragOperation,
} from '../dragDropUtils';
import type { EditorTodo } from '../../types';

describe('dragDropUtils', () => {
  describe('isChildOf', () => {
    it('should return true for direct child relationship', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(true);
    });

    it('should return true for multiple consecutive children', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
        { id: 4, text: 'Child 3', completed: false, indent: 1 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(true);
      expect(isChildOf(1, 3, todos)).toBe(true);
      expect(isChildOf(1, 4, todos)).toBe(true);
    });

    it('should return false when target comes before source', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(isChildOf(2, 1, todos)).toBe(false);
    });

    it('should return false when target and source are at same indent level', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent 1', completed: false, indent: 0 },
        { id: 2, text: 'Parent 2', completed: false, indent: 0 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(false);
    });

    it('should return false when target indent is not greater than source', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
        { id: 3, text: 'Another Parent', completed: false, indent: 0 },
      ];

      expect(isChildOf(1, 3, todos)).toBe(false);
    });

    it('should return false when todos are in different sections (completion status)', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: true, indent: 1 },
      ];

      expect(isChildOf(1, 2, todos)).toBe(false);
    });

    it('should return false when relationship is broken by intermediate parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent 1', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Parent 2', completed: false, indent: 0 },
        { id: 4, text: 'Child 2', completed: false, indent: 1 },
      ];

      expect(isChildOf(1, 4, todos)).toBe(false);
    });

    it('should return false for same todo', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
      ];

      expect(isChildOf(1, 1, todos)).toBe(false);
    });

    it('should return false when source index is not found', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(isChildOf(999, 2, todos)).toBe(false);
    });

    it('should return false when target index is not found', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(isChildOf(1, 999, todos)).toBe(false);
    });

    it('should return false when both indices are not found', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
      ];

      expect(isChildOf(999, 888, todos)).toBe(false);
    });
  });

  describe('computeSection', () => {
    it('should return active for uncompleted parent without children', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
      ];

      expect(computeSection(todos, 1)).toBe('active');
    });

    it('should return active for uncompleted parent with children', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(computeSection(todos, 1)).toBe('active');
    });

    it('should return completed for completed parent with all completed children', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child 1', completed: true, indent: 1 },
        { id: 3, text: 'Child 2', completed: true, indent: 1 },
      ];

      expect(computeSection(todos, 1)).toBe('completed');
    });

    it('should return active for completed parent with any uncompleted child', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child 1', completed: true, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
      ];

      expect(computeSection(todos, 1)).toBe('active');
    });

    it('should return active for uncompleted child regardless of parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      expect(computeSection(todos, 2)).toBe('active');
    });

    it('should return active for completed child with uncompleted parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: true, indent: 1 },
      ];

      expect(computeSection(todos, 2)).toBe('active');
    });

    it('should return completed for completed child with completed parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child', completed: true, indent: 1 },
      ];

      expect(computeSection(todos, 2)).toBe('completed');
    });

    it('should return active for non-existent todo id', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
      ];

      expect(computeSection(todos, 999)).toBe('active');
    });

    it('should handle child without explicit parent in list', () => {
      const todos: EditorTodo[] = [
        { id: 2, text: 'Orphan Child', completed: true, indent: 1 },
      ];

      expect(computeSection(todos, 2)).toBe('active');
    });
  });

  describe('extractTodoBlock', () => {
    it('should extract single parent without children', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Another Parent', completed: false, indent: 0 },
      ];

      const result = extractTodoBlock(todos, 0);

      expect(result.block).toEqual([todos[0]]);
      expect(result.endIndex).toBe(0);
    });

    it('should extract parent with single child', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
        { id: 3, text: 'Another Parent', completed: false, indent: 0 },
      ];

      const result = extractTodoBlock(todos, 0);

      expect(result.block).toEqual([todos[0], todos[1]]);
      expect(result.endIndex).toBe(1);
    });

    it('should extract parent with multiple children', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
        { id: 4, text: 'Child 3', completed: false, indent: 1 },
        { id: 5, text: 'Another Parent', completed: false, indent: 0 },
      ];

      const result = extractTodoBlock(todos, 0);

      expect(result.block).toEqual([todos[0], todos[1], todos[2], todos[3]]);
      expect(result.endIndex).toBe(3);
    });

    it('should extract only single child item (not a parent)', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      const result = extractTodoBlock(todos, 1);

      expect(result.block).toEqual([todos[1]]);
      expect(result.endIndex).toBe(1);
    });

    it('should extract parent at end of list with children', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'First Parent', completed: false, indent: 0 },
        { id: 2, text: 'Last Parent', completed: false, indent: 0 },
        { id: 3, text: 'Child 1', completed: false, indent: 1 },
        { id: 4, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = extractTodoBlock(todos, 1);

      expect(result.block).toEqual([todos[1], todos[2], todos[3]]);
      expect(result.endIndex).toBe(3);
    });
  });

  describe('insertTodoBlock', () => {
    it('should insert block at beginning of list', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
      ];
      const block: EditorTodo[] = [
        { id: 3, text: 'New Todo', completed: false, indent: 0 },
      ];

      const result = insertTodoBlock(todos, block, 0);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(block[0]);
      expect(result[1]).toEqual(todos[0]);
      expect(result[2]).toEqual(todos[1]);
    });

    it('should insert block in middle of list', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
      ];
      const block: EditorTodo[] = [
        { id: 3, text: 'New Todo', completed: false, indent: 0 },
      ];

      const result = insertTodoBlock(todos, block, 1);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(todos[0]);
      expect(result[1]).toEqual(block[0]);
      expect(result[2]).toEqual(todos[1]);
    });

    it('should insert block at end of list', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
      ];
      const block: EditorTodo[] = [
        { id: 3, text: 'New Todo', completed: false, indent: 0 },
      ];

      const result = insertTodoBlock(todos, block, 2);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(todos[0]);
      expect(result[1]).toEqual(todos[1]);
      expect(result[2]).toEqual(block[0]);
    });

    it('should insert multi-item block', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
      ];
      const block: EditorTodo[] = [
        { id: 2, text: 'Parent', completed: false, indent: 0 },
        { id: 3, text: 'Child 1', completed: false, indent: 1 },
        { id: 4, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = insertTodoBlock(todos, block, 0);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(block[0]);
      expect(result[1]).toEqual(block[1]);
      expect(result[2]).toEqual(block[2]);
      expect(result[3]).toEqual(todos[0]);
    });

    it('should not mutate original array', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
      ];
      const block: EditorTodo[] = [
        { id: 2, text: 'New Todo', completed: false, indent: 0 },
      ];

      const result = insertTodoBlock(todos, block, 0);

      expect(result).not.toBe(todos);
      expect(todos).toHaveLength(1);
    });
  });

  describe('removeTodoBlock', () => {
    it('should remove single item', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
        { id: 3, text: 'Todo 3', completed: false, indent: 0 },
      ];

      const result = removeTodoBlock(todos, 1, 1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(todos[0]);
      expect(result[1]).toEqual(todos[2]);
    });

    it('should remove multiple items', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
        { id: 3, text: 'Todo 3', completed: false, indent: 0 },
        { id: 4, text: 'Todo 4', completed: false, indent: 0 },
      ];

      const result = removeTodoBlock(todos, 1, 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(todos[0]);
      expect(result[1]).toEqual(todos[3]);
    });

    it('should remove parent with children block', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
        { id: 4, text: 'Another Todo', completed: false, indent: 0 },
      ];

      const result = removeTodoBlock(todos, 0, 2);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(todos[3]);
    });

    it('should remove from beginning', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
      ];

      const result = removeTodoBlock(todos, 0, 0);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(todos[1]);
    });

    it('should remove from end', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
      ];

      const result = removeTodoBlock(todos, 1, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(todos[0]);
    });

    it('should not mutate original array', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
      ];

      const result = removeTodoBlock(todos, 0, 0);

      expect(result).not.toBe(todos);
      expect(todos).toHaveLength(2);
    });
  });

  describe('fixOrphanedChildren', () => {
    it('should outdent child without parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Orphan Child', completed: false, indent: 1 },
      ];

      const result = fixOrphanedChildren(todos, 0);

      expect(result[0].indent).toBe(0);
    });

    it('should outdent child at beginning without parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Orphan Child', completed: false, indent: 1 },
        { id: 2, text: 'Parent', completed: false, indent: 0 },
      ];

      const result = fixOrphanedChildren(todos, 0);

      expect(result[0].indent).toBe(0);
    });

    it('should not modify child with parent', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      const result = fixOrphanedChildren(todos, 1);

      expect(result[1].indent).toBe(1);
      expect(result).toEqual(todos);
    });

    it('should not modify parent item (indent 0)', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
      ];

      const result = fixOrphanedChildren(todos, 0);

      expect(result[0].indent).toBe(0);
      expect(result).toEqual(todos);
    });

    it('should not modify child when there are only children before it', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Child 1', completed: false, indent: 1 },
        { id: 2, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = fixOrphanedChildren(todos, 1);

      expect(result[1].indent).toBe(0);
    });

    it('should not mutate original array when no changes needed', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      const result = fixOrphanedChildren(todos, 1);

      expect(result).not.toBe(todos);
    });
  });

  describe('findLastIndexInSection', () => {
    it('should find last index in active section', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Active 1', completed: false, indent: 0 },
        { id: 2, text: 'Active 2', completed: false, indent: 0 },
        { id: 3, text: 'Completed', completed: true, indent: 0 },
      ];

      const result = findLastIndexInSection(todos, 'active');

      expect(result).toBe(1);
    });

    it('should find last index in completed section', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Active', completed: false, indent: 0 },
        { id: 2, text: 'Completed 1', completed: true, indent: 0 },
        { id: 3, text: 'Completed 2', completed: true, indent: 0 },
      ];

      const result = findLastIndexInSection(todos, 'completed');

      expect(result).toBe(2);
    });

    it('should return -1 for empty list', () => {
      const todos: EditorTodo[] = [];

      const result = findLastIndexInSection(todos, 'active');

      expect(result).toBe(-1);
    });

    it('should return -1 when section does not exist', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Active', completed: false, indent: 0 },
      ];

      const result = findLastIndexInSection(todos, 'completed');

      expect(result).toBe(-1);
    });

    it('should handle parent with children correctly', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Active Parent', completed: false, indent: 0 },
        { id: 2, text: 'Active Child', completed: false, indent: 1 },
        { id: 3, text: 'Completed Parent', completed: true, indent: 0 },
        { id: 4, text: 'Completed Child', completed: true, indent: 1 },
      ];

      const activeResult = findLastIndexInSection(todos, 'active');
      const completedResult = findLastIndexInSection(todos, 'completed');

      expect(activeResult).toBe(1);
      expect(completedResult).toBe(3);
    });

    it('should handle mixed completion states', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: true, indent: 0 },
        { id: 2, text: 'Child 1', completed: true, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = findLastIndexInSection(todos, 'active');

      // Parent with any uncompleted child stays in active
      expect(result).toBe(2);
    });
  });

  describe('validateDragOperation', () => {
    it('should return valid for normal reorder within same section', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
        { id: 2, text: 'Todo 2', completed: false, indent: 0 },
      ];

      const result = validateDragOperation(1, 2, todos);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return invalid when dropping on self', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Todo 1', completed: false, indent: 0 },
      ];

      const result = validateDragOperation(1, 1, todos);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot drop on self');
    });

    it('should return invalid when dropping across sections', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Active', completed: false, indent: 0 },
        { id: 2, text: 'Completed', completed: true, indent: 0 },
      ];

      const result = validateDragOperation(1, 2, todos);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot drop across sections');
    });

    it('should return invalid when dropping parent under its child', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child', completed: false, indent: 1 },
      ];

      const result = validateDragOperation(1, 2, todos);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot drop parent under child');
    });

    it('should return valid for reordering children', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = validateDragOperation(2, 3, todos);

      expect(result.valid).toBe(true);
    });

    it('should return valid for moving parent blocks', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Parent 1', completed: false, indent: 0 },
        { id: 2, text: 'Child 1', completed: false, indent: 1 },
        { id: 3, text: 'Parent 2', completed: false, indent: 0 },
        { id: 4, text: 'Child 2', completed: false, indent: 1 },
      ];

      const result = validateDragOperation(1, 3, todos);

      expect(result.valid).toBe(true);
    });

    it('should handle completed section correctly', () => {
      const todos: EditorTodo[] = [
        { id: 1, text: 'Completed 1', completed: true, indent: 0 },
        { id: 2, text: 'Completed 2', completed: true, indent: 0 },
      ];

      const result = validateDragOperation(1, 2, todos);

      expect(result.valid).toBe(true);
    });
  });
});
