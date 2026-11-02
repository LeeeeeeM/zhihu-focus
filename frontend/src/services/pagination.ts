export function mergeUnique<T>(existing: T[], incoming: T[], key: (item: T) => string): { items: T[]; freshCount: number } {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const item of existing) {
    const identity = key(item);
    if (!seen.has(identity)) { seen.add(identity); items.push(item); }
  }
  const previousCount = items.length;
  for (const item of incoming) {
    const identity = key(item);
    if (!seen.has(identity)) { seen.add(identity); items.push(item); }
  }
  return { items, freshCount: items.length - previousCount };
}

export const contentKey = (item: { kind: string; id: string }) => `${item.kind}:${item.id}`;
export const idKey = (item: { id: string }) => item.id;

export function nextPageState(nextCursor: string | undefined, hasMore: boolean, currentCursor = '') {
  const cursor = hasMore && nextCursor && nextCursor !== currentCursor ? nextCursor : '';
  return { cursor, hasMore: Boolean(cursor) };
}
