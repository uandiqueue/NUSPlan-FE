import { exportJson } from "../tester";
import type { PopulatedProgramPayload, CourseBox } from '../../types/shared/populator';
import type { ModuleCode } from '../../types/shared/nusmods-types';
import {
    LookupTable,
    RequirementNodeInfo,
    Logic,
} from '../../types/feValidator';
import { enforceRequirementPriority } from './requirementPriority';

// Normalise the payload from PopulatedProgramPayload to LookupTable
// Basically builds lookup maps from payload
export function normalisePayload(
    payload: PopulatedProgramPayload,
): LookupTable {
    const requiredUnits: Record<string, number> = {}; // requirementKey -> number of units required
    const nodeInfo: Record<string, RequirementNodeInfo> = {};  // requirementKey -> logic/children/parent key
    const modulesByRequirement: Record<string, ModuleCode[]> = {}; // requirementKey -> array of moduleCodes 
    const requirementsByModule: Record<ModuleCode, string[]> = {}; // moduleCode -> array of requirementKeys 
    const {
        tags,
        units,
        prereqs,
        preclusions,
        maxRequirements,
        minRequirements,
        selected = [],
        version,
    } = payload.lookup; // LookupPayload fields (from BE)

    // Helpers
    const makeKey = (...parts: string[]) => parts.filter(Boolean).join(":");
    function link(rk: string, code: ModuleCode) {
        const forward = (modulesByRequirement[rk] ||= []);
        if (!forward.includes(code)) forward.push(code);
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
                const dropBE = box.boxKey; 
                box.options.forEach(opt => {
                    link(dropBE, opt.courseCode);
                    link(parentBE, opt.courseCode);
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
                    const pathBE = p.id;
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
    } as LookupTable;

    enforceRequirementPriority(lookupTable);
    //exportJson("lookupTable.json", lookupTable); // DEBUG

    return lookupTable;
}
