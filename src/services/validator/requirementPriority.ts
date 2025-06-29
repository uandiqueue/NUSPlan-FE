import { LookupTable } from "../../types/feValidator";

// Priority order
const priorityOrder = [
    "core_essentials",
    "core_electives",
    "common_core",
    "core_others",
    "unrestricted_electives",
];

/* 
Strips requirementKeys from modules based on priority.
Ensures a module only contributes to ONE requirement section per programme.
 */
export function enforceRequirementPriority(flat: LookupTable) {
    Object.entries(flat.requirementsByModule).forEach(([code, keys]) => {
        if (!Array.isArray(keys)) return;

        // Group keys by root section name (eg: core-essentials, common-core)
        const groupByRoot = new Map<string, string[]>();
        for (const key of keys) {
            const section = key.split("-").slice(2)[0];
            //console.info(key, section); // DEBUG
            if (!groupByRoot.has(section)) groupByRoot.set(section, []);
            groupByRoot.get(section)!.push(key);
        }

        for (const section of priorityOrder) {
            const keepKeys = groupByRoot.get(section);
            if (keepKeys && keepKeys.length > 0) {
                flat.requirementsByModule[code] = keepKeys;
                return;
            }
        }

        // If no known section matched, keep all original keys
        console.warn(`No matching section for ${code} (${keys}). Keeping original requirementKeys`); // DEBUG
    });

    // Rebuild modulesByRequirement by filtering to only keys in updated reverse map
    Object.entries(flat.modulesByRequirement).forEach(([reqKey, moduleList]) => {
        flat.modulesByRequirement[reqKey] = moduleList.filter((code) =>
            flat.requirementsByModule[code]?.includes(reqKey)
        );
    });
}