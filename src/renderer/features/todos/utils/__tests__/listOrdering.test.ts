import { sortListsByRecency } from '../listOrdering';

describe('sortListsByRecency', () => {
  it('falls back to alphabetical order when updatedAt matches', () => {
    const lists = [
      { id: 'b', name: 'Bravo', updatedAt: '2025-01-01T00:00:00.000Z' },
      { id: 'a', name: 'Alpha', updatedAt: '2025-01-01T00:00:00.000Z' },
      { id: 'c', name: 'Charlie', updatedAt: '2024-12-31T23:59:59.000Z' },
    ];

    const sorted = sortListsByRecency(lists);

    expect(sorted.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
});
