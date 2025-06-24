import type { LookupTable, TagStripMap, Usage } from '../../types/feValidator';
import { ModuleCode } from '../../types/shared/nusmods-types';
import { buildDependencyMaps } from './dependencyMaps';
import { prereqSatisfied } from './prereqChecker';
import { prettify } from './prettyPrereq';

/** Validate every time selection changes */
export function validateSelection(
    picked: ModuleCode[],
    flat: LookupTable,
) {
    const pickedSet = new Set(picked);
    // Quick maps (selected -> prereq/preclusion arrays)
    const { prereqOf, precludeOf } = buildDependencyMaps(pickedSet, flat);

    // Prerequisite warnings (NOT done yet, now is just returning flat list)
    const warnings: string[] = [];
    for (const code of picked) {
        const rule = flat.prereqs?.[code];
        if (!prereqSatisfied(pickedSet, rule)) {
            warnings.push(`${code} prerequisite: ${prettify(rule)}`);
        }
    }

    // Block precluded courses (NOT done, not yet remove from course pool)
    const blocked = new Set<ModuleCode>();
    picked.forEach(code => {
        const list = flat.preclusions[code] ?? [];
        list.forEach(clash => blocked.add(clash));
    });

    // Max logic 
    const strip: TagStripMap = {};
    // Accumulate units for each max tag among selected modules
    const usage: Record<string, Usage> = {};
    picked.forEach(code => {
        (flat.maxRequirements[code] ?? []).forEach(rule => {
            const rec = usage[rule.tag] ||= { 
                used: 0, 
                max: rule.maxUnits, 
                rule 
            };
            rec.used += flat.units[code] || 0;
        });
    });
    // For each over-cap tag, add un-selected courses in that rule into strip list
    Object.values(usage).forEach(({ used, max, rule }) => {
        if (used <= max) return; // cap not hit
        const parentReq = rule.tag // e.g. "elective-max_level_2000_cap-..."
            .replace(/_max.*$/, ''); // "elective"
        
        rule.courses.forEach(code => {
            if (pickedSet.has(code)) return; // Keep tags on courses already chosen
            // Remove only tags that belong to this parent requirement
            const toStrip = (flat.tags[code] ?? []).filter(t => t.startsWith(parentReq));
            if (!toStrip.length) return; // No tags to strip, skip
            strip[code] = [...(strip[code] ?? []), ...toStrip]; // Add to strip list
        });
    });

    // Progress helper example — UI can call this
    const progress = (rk: string) => {
        const need = flat.minRequirements[rk] ?? 0;
        const have = (flat.modulesByRequirement[rk] ?? []) 
            .filter(c => pickedSet.has(c))
            .filter(c => !(strip[c]?.includes(rk)))
            .reduce((sum, c) => sum + (flat.units[c] || 0), 0);
        return { have, need, percent: need ? have / need : 1 };
    };

    return { 
        warnings, 
        blocked, 
        stripped: strip, 
        prereqOf, 
        precludeOf, 
        progress 
    };
}