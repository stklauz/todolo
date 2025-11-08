import { debugLogger } from '../../../utils/debug';

type RecencySortable = {
  name: string;
  updatedAt: string;
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
    const aTime = timestampOrThrow(a.updatedAt, { id: a.id, name: a.name });
    const bTime = timestampOrThrow(b.updatedAt, { id: b.id, name: b.name });
    if (bTime !== aTime) return bTime - aTime;
    return a.name.localeCompare(b.name);
  });
  debugLogger.log('info', 'Lists sorted by recency', {
    firstListId: sorted[0]?.id,
    count: sorted.length,
  });
  return sorted;
};
