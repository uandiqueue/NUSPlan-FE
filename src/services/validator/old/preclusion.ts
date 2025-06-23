import type { LookupPayload } from '../../../types/shared/validator';

export function findClash(
  code: string,
  picked: Set<string>,
  lookup: LookupPayload
): string | null {
  const list = lookup.preclusions?.[code] ?? [];
  const hit  = list.find((c) => picked.has(c.replace(/:D$/, '')));
  return hit ?? null;
}
