import type { LookupTables } from '../../app/types/payload';

export function prereqSatisfied(
  code: string,
  picked: Set<string>,
  lookup: LookupTables
): boolean {
  const rule = lookup.prereqs?.[code];
  if (!rule) return true; 

  const test = (r: any): boolean => {
    if (typeof r === 'string') return picked.has(r.replace(/:D$/, ''));
    if ('and' in r) return r.and.every(test);
    if ('or' in r) return r.or.some(test);
    return true;
  };

  return test(rule);
}
