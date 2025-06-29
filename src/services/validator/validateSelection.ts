import type { LookupTable, TagStripMap, Usage } from '../../types/feValidator';
import { ModuleCode } from '../../types/shared/nusmods-types';
import { buildDependencyMaps } from './dependencyMaps';
import { prereqSatisfied } from './prereqChecker';
import { prettify } from './prettyPrereq';

/* Validate every time selection changes */
export function validateSelection(
    picked: ModuleCode[],
    flat: LookupTable,
    fe2be: Record<string, string> // REDUNDANT past relics
) {
    const pickedSet = new Set(picked);

    // Prereq & preclusion dependency maps
    const { prereqOf, precludeOf } = buildDependencyMaps(pickedSet, flat);

    // Prerequisite warnings
    const warnings: string[] = [];
    for (const code of picked) {
        const rule = flat.prereqs?.[code];
        if (!prereqSatisfied(pickedSet, rule)) {
            warnings.push(`${code} prerequisite: ${prettify(rule)}`);
            console.warn(warnings[warnings.length - 1]); // DEBUG
        }
    }

    // Block modules that clash (preclusions)
    const blocked = new Set<ModuleCode>();
    picked.forEach((code) => {
        (flat.preclusions[code] ?? []).forEach((clash) => blocked.add(clash));
        console.log(`Blocked ${flat.preclusions[code]} due to preclusions of ${code}`); // DEBUG
    });

    // Max-rule tag stripping
    const strip: TagStripMap = {};
    const usage: Record<string, Usage> = {};

    picked.forEach((code) => {
        (flat.maxRequirements[code] ?? []).forEach((rule) => {
            const rec = (usage[rule.tag] ??= {
                used: 0,
                max: rule.maxUnits,
                rule,
                pickedCodes: [],
            });
            rec.used += flat.units[code] || 0;
            rec.pickedCodes.push(code);
        });
    });

Object.values(usage).forEach(({ used, max, rule, pickedCodes }) => {
  if (used > max) {                         // strictly greater, not ≥
    let surplus = used - max;
    // Strip tags from picked courses, newest first
    for (let i = pickedCodes.length - 1; i >= 0 && surplus > 0; i--) {
      const code = pickedCodes[i];
      const mc   = flat.units[code] || 0;
      strip[code] = [ ...(strip[code] ?? []), rule.tag ];
      blocked.add(code);                    // can’t pick again
      surplus -= mc;
    }
    warnings.push(
      `Exceeded ${max} MC for ${rule.tag.replace(/_max.*/, '')}; ` +
      `extra modules wont count.`
    );
  }
});

    // Progress helper
    function progress(feKey: string) {
        // 1. units required (FE map) 
        const need = flat.requiredUnits[feKey] ?? 0;

        // 2. translate FE => BE once
        const beKey = fe2be[feKey];
        if (!beKey) {
        console.warn(`No BE key found for FE key: ${feKey}`);
        return { have: 0, need: need, percent: 0 };
        }

        // 3. units already earned
        const have = (flat.modulesByRequirement[beKey] ?? [])
            .filter((c) => pickedSet.has(c))
            .filter((c) => !(strip[c]?.includes(feKey)))
            .reduce((sum, c) => sum + (flat.units[c] || 0), 0);

        //console.log(`Progress for ${feKey}: need ${need}, have ${have}`); // DEBUG

        return { have, need, percent: need ? have / need : 1 };
    }

    return { warnings, blocked, stripped: strip, prereqOf, precludeOf, progress };
}