import type { LookupTable } from '../../types/feValidator';
import { ModuleCode } from '../../types/shared/nusmods-types';
import { buildDependencyMaps }  from './dependencyMaps';
import { prereqSatisfied }      from './rules';

/** Validate every time selection changes */
export function validateSelection(
    picked: ModuleCode[],
    flat: LookupTable,
) {
    const pickedSet = new Set(picked);
    const { prereqOf, precludeOf } = buildDependencyMaps(pickedSet, flat);

    // Prerequisite warnings (NOT done yet, now is just returning flat list)
    const warnings: string[] = [];
    for (const code of picked) {
        const rule = flat.prereqs?.[code];
        if (!prereqSatisfied(code, pickedSet, rule)) {
            warnings.push(`${code} requires ${prereqOf[code].join(', ')}`);
        }
    }

    // Block precluded courses (NOT done, not yet remove from course pool)
    const blocked = new Set<string>();
    for (const list of Object.values(precludeOf)) list.forEach(code => blocked.add(code));

    // Double-count & max logic (NOT done, is just adding structure))
    const tagUnits: Record<string, number> = {};
    picked.forEach(code =>
        (flat.tags[code] ?? []).forEach(t => tagUnits[t] = (tagUnits[t] ?? 0) + (flat.units[code] || 0)),
    );
    const disabledTags = Object.entries(tagUnits).filter(([, au]) => au > 8).map(([t]) => t);

    // Progress helper example — UI can call this
    const progress = (rk: string) => {
        const need = flat.minRequirements[rk] ?? 0;
        const have = (flat.modulesByRequirement[rk] ?? [])
            .filter(c => pickedSet.has(c))
            .reduce((s, c) => s + (flat.units[c] || 0), 0);
        return { have, need, pct: need ? have / need : 1 };
    };

    return { warnings, blocked, disabledTags, prereqOf, precludeOf, progress };
}
