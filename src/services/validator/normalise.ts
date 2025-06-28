import { exportJson } from "../tester";
import type { PopulatedProgramPayload, CourseBox } from '../../types/shared/populator';
import type { ModuleCode } from '../../types/shared/nusmods-types';
import type {
    TagMap,
    UnitMap,
    PrereqMap,
    MaxMap,
    PreclusionMap,
} from '../../types/shared/validator';
import {
    LookupTable,
    RequirementNodeInfo,
    Logic,
} from '../../types/feValidator';

/* 
Normalise one payload
Never mutates the original payload objects, just reads them. 
*/
export function normalisePayload(
    payload: PopulatedProgramPayload,
): LookupTable {
    // UI‑facing
    const requiredUnits: Record<string, number> = {}; // FE key
    const nodeInfo: Record<string, RequirementNodeInfo> = {}; // FE key

    // Validation‑facing (BE keys)
    const modulesByRequirement: Record<string, ModuleCode[]> = {};
    const requirementsByModule: Record<ModuleCode, string[]> = {};

    // Merged lookup maps from all payloads (keep BE keys)
    const {
        tags,
        units,
        prereqs,
        preclusions,
        maxRequirements,
        minRequirements,
        selected = [],
        version,
    } = payload.lookup;

    // Helpers
    const makeKey = (...parts: string[]) => parts.filter(Boolean).join(":");
    function link(rk: string, code: ModuleCode) {
        // requirementKey -> modules (no duplication)
        const forward = (modulesByRequirement[rk] ||= []);
        if (!forward.includes(code)) forward.push(code);

        // module -> requirementKeys (no duplication)
        const reverse = (requirementsByModule[code] ||= []);
        if (!reverse.includes(rk)) reverse.push(rk);
    }
    function attach(
        feKey: string,
        parentFE: string | null,
        logic: Logic,
        title: string,
        nOf?: number,
    ) {
        nodeInfo[feKey] = {
            logic,
            parent: parentFE,
            children: [],
            title,
            ...(nOf ? { nOf } : {}),
        };
        if (parentFE) nodeInfo[parentFE].children.push(feKey);
    }

    // Traverse and build maps
    function traverse(
        box: CourseBox,
        parentFE: string,
        parentBE: string,
    ) {
        switch (box.kind) {
            // exact leaf
            case "exact": {
                const leafFE = makeKey(parentFE, box.course.courseCode);
                attach(leafFE, parentFE, "LEAF", box.course.courseCode);
                link(parentBE, box.course.courseCode);
                break;
            }

            // dropdown
            case "dropdown": {
                const dropFE = makeKey(parentFE, "dropdown");
                attach(dropFE, parentFE, "OR", box.UILabel);
                const dropBE = box.boxKey; // Unique key supplied by backend
                box.options.forEach(opt => {
                    // keep original mapping (dropdown-key → course)
                    link(dropBE,    opt.courseCode);

                    // NEW: map parent section (parentBE) → course
                    link(parentBE,  opt.courseCode);
                });
                break;
            }

            // altPath
            case "altPath": {
                const altFE = makeKey(parentFE, "altPath");
                attach(altFE, parentFE, "OR", box.UILabel);

                box.paths.forEach((p, i) => {
                    const pathFE = makeKey(altFE, `path${i}`);
                    attach(pathFE, altFE, "AND", `Path ${i + 1}`);

                    const pathBE = p.id; // Unique per path
                    p.boxes.forEach(inner => traverse(inner, pathFE, parentBE));
                });
                break;
            }
        }
    }

    // Top‑level sections
    for (const sec of payload.requirements) {
        requiredUnits[sec.requirementKey] = sec.requiredUnits ?? 0;

        attach(sec.requirementKey, null, 'SECTION', sec.label);
        sec.boxes.forEach((b) => traverse(b, sec.requirementKey, sec.requirementKey));
    }

    // Build LookupTable
    const lookupTable: LookupTable = {
        requiredUnits,
        modulesByRequirement,
        requirementsByModule,
        nodeInfo,
        tags,
        units,
        prereqs,
        preclusions,
        maxRequirements,
        minRequirements,
        selected,
        version,
    } as LookupTable; // casting because LookupTable hasn’t fe2be/be2fe fields

    //exportJson("lookupTable.json", lookupTable); // DEBUG

    return lookupTable;
}
