import { describe, expect, it } from '@jest/globals';
import type { EditorTodo, Section } from '../types';
import {
  canAttachChild,
  reparentChildren,
  outdentChildren,
} from '../utils/todoUtils';

const t = (
  id: number,
  completed = false,
  indent = 0,
  parentId: number | null = null,
): EditorTodo => ({
  id,
  text: `t${id}`,
  completed,
  indent,
  parentId,
});

describe('hierarchy helpers', () => {
  it('canAttachChild forbids cross-section parenting', () => {
    const pairs: Array<[Section, Section, boolean]> = [
      ['active', 'active', true],
      ['completed', 'completed', true],
      ['active', 'completed', false],
      ['completed', 'active', false],
    ];
    for (const [p, c, expected] of pairs) {
      expect(canAttachChild(p, c)).toBe(expected);
    }
  });

  it('reparentChildren moves only immediate children to new parent', () => {
    // 1 (parent) -> 2 (child of 1) -> 3 (grandchild of 2)
    const todos = [
      t(1, false, 0, null),
      t(2, false, 1, 1),
      t(3, false, 1, 2),
      t(10, false, 0, null),
    ];

    const next = reparentChildren(1, 10, todos);
    const byId = new Map(next.map((x) => [x.id, x] as const));
    expect(byId.get(2)?.parentId).toBe(10);
    // grandchild remains attached to its current parent (2)
    expect(byId.get(3)?.parentId).toBe(2);
  });

  it('outdentChildren moves only immediate children to top-level and sets indent 0', () => {
    const todos = [
      t(1, false, 0, null),
      t(2, false, 1, 1),
      t(3, false, 1, 2),
      t(4, false, 1, 1),
    ];
    const next = outdentChildren(1, todos);
    const byId = new Map(next.map((x) => [x.id, x] as const));
    expect(byId.get(2)?.parentId).toBeNull();
    expect(byId.get(2)?.indent).toBe(0);
    expect(byId.get(4)?.parentId).toBeNull();
    expect(byId.get(4)?.indent).toBe(0);
    // grandchild remains attached to its current parent (2), not directly affected here
    expect(byId.get(3)?.parentId).toBe(2);
  });
});
