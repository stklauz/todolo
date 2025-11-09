import { debugLogger } from '../../../utils/debug';

type RecencySortable = {
  name: string;
  updatedAt: string;
  // Optional to preserve compatibility with existing tests/usages
  createdAt?: string;
  id?: string;
};

const timestampOrThrow = (iso: string, context: Record<string, unknown>) => {
  const parsed = Date.parse(iso);
  if (Number.isFinite(parsed)) return parsed;
  debugLogger.log('warn', 'Invalid list updatedAt encountered', {
    ...context,
    updatedAt: iso,
  });
  return 0;
};

export const sortListsByRecency = <T extends RecencySortable>(
  lists: T[],
): T[] => {
  const sorted = [...lists].sort((a, b) => {
    // Primary: updatedAt (desc)
    const aUpdated = timestampOrThrow(a.updatedAt, { id: a.id, name: a.name });
    const bUpdated = timestampOrThrow(b.updatedAt, { id: b.id, name: b.name });
    if (bUpdated !== aUpdated) return bUpdated - aUpdated;

    // Secondary: createdAt (desc) when provided on both
    if (a.createdAt && b.createdAt) {
      const aCreated = timestampOrThrow(a.createdAt, {
        id: a.id,
        name: a.name,
      });
      const bCreated = timestampOrThrow(b.createdAt, {
        id: b.id,
        name: b.name,
      });
      if (bCreated !== aCreated) return bCreated - aCreated;
    }

    // Tertiary: name (asc)
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;

    // Final tiebreaker: id (asc) if available; guarantees stability across engines
    if (a.id && b.id) return a.id.localeCompare(b.id);
    return 0;
  });
  debugLogger.log('info', 'Lists sorted by recency', {
    firstListId: sorted[0]?.id,
    count: sorted.length,
  });
  return sorted;
};
