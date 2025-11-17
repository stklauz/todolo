import {
  createNewTodo,
  computeSectionById,
  isChildOf,
  groupTodosBySection,
  computeIndeterminateState,
  deriveIndentFromParentId,
  computeParentForIndentChange,
  reparentChildren,
  outdentChildren,
} from '../todoUtils';
import { MAX_INDENT, MIN_INDENT } from '../constants';
import type { EditorTodo } from '../../types';

const createLookup = (todos: EditorTodo[]) => {
  const map = new Map<number, EditorTodo>();
  todos.forEach((todo) => {
    if (typeof todo.id === 'number') {
      map.set(todo.id, todo);
    }
  });
  return (id: number) => map.get(id);
};

describe('todoUtils.createNewTodo defaults', () => {
  test('sets parentId=null by default', () => {
    const todo = createNewTodo('hello', 1);
    expect((todo as any).parentId).toBeNull();
  });

  test('indent remains a rendering concern and is clamped', () => {
    const low = createNewTodo('low', 2, -10);
    const high = createNewTodo('high', 3, 999);
    expect(low.indent).toBeGreaterThanOrEqual(MIN_INDENT);
    expect(high.indent).toBeLessThanOrEqual(MAX_INDENT);
  });
});

describe('deriveIndentFromParentId', () => {
  it('returns 0 for top-level todo (parentId === null)', () => {
    const todo: EditorTodo = {
      id: 1,
      text: 'Top-level',
      completed: false,
      parentId: null,
    };
    expect(deriveIndentFromParentId(todo)).toBe(0);
  });

  it('returns depth from ancestor chain for nested todos', () => {
    const grandParent: EditorTodo = {
      id: 1,
      text: 'Grand Parent',
      completed: false,
      parentId: null,
    };
    const parent: EditorTodo = {
      id: 2,
      text: 'Parent',
      completed: false,
      parentId: 1,
    };
    const child: EditorTodo = {
      id: 3,
      text: 'Child',
      completed: false,
      parentId: 2,
    };
    const greatGrandChild: EditorTodo = {
      id: 4,
      text: 'Great grand child',
      completed: false,
      parentId: 3,
    };

    const lookup = createLookup([grandParent, parent, child, greatGrandChild]);
    expect(deriveIndentFromParentId(grandParent, { lookup })).toBe(0);
    expect(deriveIndentFromParentId(parent, { lookup })).toBe(1);
    expect(deriveIndentFromParentId(child, { lookup })).toBe(2);
    expect(deriveIndentFromParentId(greatGrandChild, { lookup })).toBe(3);
  });

  it('clamps derived depth using MAX_INDENT', () => {
    const chain: EditorTodo[] = [];
    let prev: number | null = null;
    for (let i = 1; i <= 10; i += 1) {
      chain.push({
        id: i,
        text: `Node ${i}`,
        completed: false,
        parentId: prev,
      });
      prev = i;
    }
    const lookup = createLookup(chain);
    expect(deriveIndentFromParentId(chain[chain.length - 1], { lookup })).toBe(
      MAX_INDENT,
    );
  });

  it('guards against cycles by clamping', () => {
    const cyclic: EditorTodo = {
      id: 1,
      text: 'Loop',
      completed: false,
      parentId: 1,
    };
    const lookup = (id: number) => (id === 1 ? cyclic : undefined);
    expect(deriveIndentFromParentId(cyclic, { lookup })).toBe(MIN_INDENT);
  });

  it('ignores legacy indent when parentId is defined', () => {
    const todoWithIndent1: EditorTodo = {
      id: 4,
      text: 'Mismatched indent',
      completed: false,
      parentId: null,
      indent: 1,
    };
    expect(deriveIndentFromParentId(todoWithIndent1)).toBe(0);

    const todoWithIndent0: EditorTodo = {
      id: 5,
      text: 'Child with indent 0',
      completed: false,
      parentId: 1,
      indent: 0,
    };
    const lookup = createLookup([
      { id: 1, text: 'Parent', completed: false, indent: 0, parentId: null },
      todoWithIndent0,
    ]);
    expect(deriveIndentFromParentId(todoWithIndent0, { lookup })).toBe(1);
  });

  it('uses legacy indent as a hint when lookup is unavailable', () => {
    const orphanChild: EditorTodo = {
      id: 10,
      text: 'Orphan child',
      completed: false,
      parentId: 999,
      indent: 2,
    };
    // Without lookup (no todos array), fall back to stored indent hint
    expect(deriveIndentFromParentId(orphanChild)).toBeGreaterThanOrEqual(1);
  });
});

describe('computeParentForIndentChange', () => {
  const baseTodos: EditorTodo[] = [
    { id: 1, text: 'Root', completed: false, indent: 0, parentId: null },
    { id: 2, text: 'Child A', completed: false, indent: 1, parentId: 1 },
    {
      id: 3,
      text: 'Grandchild anchor',
      completed: false,
      indent: 1,
      parentId: 2,
    },
    { id: 4, text: 'Child B', completed: false, indent: 1, parentId: 1 },
  ];

  it('returns null when target indent is MIN_INDENT', () => {
    expect(computeParentForIndentChange(baseTodos, 3, MIN_INDENT)).toBeNull();
  });

  it('finds nearest ancestor whose depth matches targetIndent - 1', () => {
    const parentId = computeParentForIndentChange(baseTodos, 4, MIN_INDENT + 2);
    expect(parentId).toBe(2);
  });

  it('finds deeper ancestor when indenting beyond level 2', () => {
    const parentId = computeParentForIndentChange(baseTodos, 4, MIN_INDENT + 3);
    expect(parentId).toBe(3);
  });

  it('returns null when no valid ancestor exists', () => {
    const orphan: EditorTodo[] = [
      { id: 1, text: 'Root', completed: false, indent: 0, parentId: null },
      { id: 2, text: 'Sibling', completed: false, indent: 0, parentId: null },
    ];
    expect(computeParentForIndentChange(orphan, 1, MIN_INDENT + 1)).toBeNull();
  });

  it('skips cross-section parents (completed vs active)', () => {
    const todos: EditorTodo[] = [
      {
        id: 1,
        text: 'Completed Root',
        completed: true,
        indent: 0,
        parentId: null,
      },
      { id: 2, text: 'Target', completed: false, indent: 0, parentId: null },
    ];
    const parentId = computeParentForIndentChange(todos, 2, MIN_INDENT + 1);
    expect(parentId).toBeNull();
  });

  it('respects MAX_INDENT by clamping when choosing parent', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'A', completed: false, indent: 0, parentId: null },
      { id: 2, text: 'B', completed: false, indent: 1, parentId: 1 },
      { id: 3, text: 'C', completed: false, indent: 2, parentId: 2 },
      { id: 4, text: 'D', completed: false, indent: 0, parentId: null },
    ];
    const parentId = computeParentForIndentChange(todos, 4, 999);
    expect(parentId).toBe(3);
  });
});

describe('reparentChildren/outdentChildren', () => {
  it('updates child parentId and derived indent when reparenting', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'Root', completed: false, indent: 0, parentId: null },
      { id: 2, text: 'Child', completed: false, indent: 1, parentId: 1 },
      { id: 3, text: 'New Root', completed: false, indent: 0, parentId: null },
    ];
    const updated = reparentChildren(1, 3, todos);
    const child = updated.find((t) => t.id === 2);
    expect(child?.parentId).toBe(3);
    expect(child?.indent).toBeGreaterThanOrEqual(MIN_INDENT + 1);
  });

  it('outdents children to top-level', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'Root', completed: false, indent: 0, parentId: null },
      { id: 2, text: 'Child', completed: false, indent: 1, parentId: 1 },
    ];
    const updated = outdentChildren(1, todos);
    const child = updated.find((t) => t.id === 2);
    expect(child?.parentId).toBeNull();
    expect(child?.indent).toBe(MIN_INDENT);
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
