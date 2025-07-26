import type { LookupPayload } from '../../types/old/shared/validator';
import type { ModuleCode } from '../../types/nusmods-types';

// Wildcard helper (For milestone 3 adding of prereq courses)
const matches = (pattern: string, code: string) =>
    pattern.includes('%') 
        ? new RegExp('^' + pattern.replace('%', '.*') + '$').test(code) 
        : pattern === code;

// Grade helper (For milestone 3 warning message)
const gradeOK = (need: string, got: string) => {
    const order = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D+', 'D', 'S', 'F', 'U'];
    return order.indexOf(got) <= order.indexOf(need);
};

// Build quick maps for selected ModuleCode -> prereqs | preclusions
export function buildDependencyMaps(
    picked: Set<ModuleCode>,
    lookup: LookupPayload,
) {
    const prereqOf: Record<ModuleCode, ModuleCode[]> = {};
    const precludeOf: Record<ModuleCode, ModuleCode[]> = {};

    for (const code of picked) {
        const rule = lookup.prereqs?.[code];
        if (rule) prereqOf[code] = leaves(rule);

        const list = lookup.preclusions?.[code] ?? [];
        if (list.length) precludeOf[code] = list;
    }
    return { prereqOf, precludeOf };
}

// Collect leaves (CourseCode) from prereq tree
function leaves(r: any): string[] {
    if (!r) return [];
    if (typeof r === 'string') {
        return [r.replace(/:.*$/, '')]; // Remove any suffix after ':' (it is the minimum grade)
    }
    if ('and' in r) return r.and.flatMap(leaves);
    if ('or'  in r) return r.or.flatMap(leaves);

    // Skipping N_OF for now
    return [];
}
