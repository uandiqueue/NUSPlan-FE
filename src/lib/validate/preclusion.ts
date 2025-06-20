import type { LookupTables } from '../../app/types/payload';

export function findClash(
  code: string,
  picked: Set<string>,
  lookup: LookupTables
): string | null {
  const list = lookup.preclusions?.[code] ?? [];
  const hit  = list.find((c) => picked.has(c.replace(/:D$/, '')));
  return hit ?? null;
}
