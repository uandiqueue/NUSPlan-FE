import type { PopulatedPayload, Course } from '../../app/types/payload';

export function tallyMC(
  payload: PopulatedPayload,
  chosen: Course[]
): Record<string, number> {
  const tally: Record<string, number> = {};
  payload.requirements.forEach((b) => (tally[b.requirementKey] = 0));

  const parentOf = (leaf: string) =>
    Object.keys(tally).find((p) => leaf.startsWith(p));

  chosen.forEach((c) => {
    payload.moduleTags
      .find((m) => m.moduleCode === c.courseCode)
      ?.tags.filter((t) => t.type === 'requirementKeys')
      .forEach((t) =>
        (t.requirementKeys ?? []).forEach((leaf) => {
          const parent = parentOf(leaf);
          if (parent) tally[parent] += c.units;
        })
      );
  });

  return tally;
}
