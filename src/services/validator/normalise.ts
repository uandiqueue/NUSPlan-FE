/* 
Turn nested Requirement tree into flat lookup maps 
*/

import { ModuleCode } from "../../types/shared/nusmods-types";
import type { PopulatedProgramPayload, CourseBox } from '../../types/shared/populator';
import type {
    TagMap, 
    UnitMap, 
    PrereqMap, 
    MaxMap,
    PreclusionMap } from '../../types/shared/validator';
import {
    LookupTable,
    RequirementNodeInfo,
    Logic
} from "../../types/feValidator";

/* 
Normalise one or more programme payloads.
Never mutates the original payload objects, just reads them. 
*/
export function normalisePayload(
    payloads: PopulatedProgramPayload[],
): LookupTable {
    // Containers built
    const requiredUnits: Record<string, number>  = {};
    const modulesByRequirement: Record<string, ModuleCode[]> = {};
    const requirementsByModule: Record<ModuleCode, string[]> = {};
    const nodeInfo: Record<string, RequirementNodeInfo>  = {};

    // Merge-holders for original backend maps
    const tags: TagMap = {};
    const units: UnitMap = {};
    const prereqs: PrereqMap = {};
    const preclusions: PreclusionMap = {};
    const maxRequirements: MaxMap = {};
    const selected: ModuleCode[] = [];
    const version: number = 1;

    // Helpers
    const makeKey = (...parts: string[]) => parts.filter(Boolean).join(':');
    const link = (rk: string, code: ModuleCode) => {
        (modulesByRequirement[rk] ||= []).push(code);
        (requirementsByModule[code] ||= []).push(rk);
    };
    function attach(
        key: string,
        parent: string | null,
        logic: Logic,
        title: string,
        nOf?: number,
    ) {
        nodeInfo[key] = { logic, parent, children: [], title, ...(nOf ? { nOf } : {}) };
        if (parent) nodeInfo[parent].children.push(key);
    }

    // Walk through the payloads and create the maps
    for (const payload of payloads) {
        const pid = `${payload.metadata.name}-${payload.metadata.type}`;

        // Merge backend lookup maps
        Object.assign(units,       payload.lookup.units);
        Object.assign(prereqs,     payload.lookup.prereqs);
        Object.assign(preclusions, payload.lookup.preclusions);
        Object.assign(tags,        payload.lookup.tags);
        Object.assign(requiredUnits, payload.lookup.minRequirements);

        // Top-level UI sections
        for (const section of payload.requirements) {
            const secKey = makeKey(pid, section.requirementKey);
            attach(secKey, null, 'SECTION', section.label);
            requiredUnits[secKey] ??= section.requiredUnits ?? 0;

            // Walk through each section and its boxes
            for (const box of section.boxes) traverse(box, [secKey], secKey);
        }

        // Traverse the CourseBox tree recursively
        function traverse(box: CourseBox, path: string[], parent: string) {
            switch (box.kind) {
                case 'exact': {
                    const key = makeKey(...path, box.course.courseCode);
                    attach(key, parent, 'LEAF', box.course.courseCode);
                    // Leaf units lives only in units map (no requirement)
                    link(key, box.course.courseCode);
                    break;
                }

                case 'dropdown': {
                    const key = makeKey(...path, 'dropdown');
                    attach(key, parent, 'OR', box.UILabel);
                    // Dropdown itself has no AU target; children do
                    box.options.forEach(opt => {
                        const leaf = makeKey(key, opt.courseCode);
                        attach(leaf, key, 'LEAF', opt.courseCode);
                        link(leaf, opt.courseCode);
                    });
                    break;
                }

                case 'altPath': {
                    const key = makeKey(...path, 'altPath');
                    attach(key, parent, 'OR', box.UILabel);
                    box.paths.forEach((p, i) => {
                        const pathKey = makeKey(key, `path${i}`);
                        attach(pathKey, key, 'AND', `Path ${i + 1}`);
                        p.boxes.forEach(inner => traverse(inner, [pathKey], pathKey));
                    });
                    break;
                }
            }
        }
    }

    // Pass through all merged maps
    return {
        requiredUnits,
        modulesByRequirement,
        requirementsByModule,
        nodeInfo,
        tags,
        units,
        prereqs,
        preclusions,

        maxRequirements,
        // minRequirements is needed to satisfy LookupPayload but not used anymore
        minRequirements: {},
        selected,
        version
    };
}
