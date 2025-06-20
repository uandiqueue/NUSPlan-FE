import { ModuleCode } from "./shared/nusmods-types";
import { TagMap, UnitMap, PrereqMap, PreclusionMap } from "./shared/validator";

export interface LookupTable {
    // requirementKey mapped to number of units required
    requiredUnits: Record<string, number>;
    // requirementKey mapped to array of moduleCodes that may fulfil it (reversed lookup of requirementsByModule)
    modulesByRequirement: Record<string, ModuleCode[]>;
    // requirementKey mapped to meta-info about logic/children/parent key
    nodeInfo: Record<string, RequirementNodeInfo>;
    // moduleCode mapped to array of requirementKeys it can fulfil (tagging)
    requirementsByModule: TagMap
    // moduleCode mapped to units of a course
    units: UnitMap;
    // moduleCode mapped to prerequisite tree
    prereqs: PrereqMap;
    // moduleCode mapped to array of precluded modules
    preclusions: PreclusionMap;
}

export interface RequirementNodeInfo {
    // AND / OR / N_OF / SECTION (Top-level) / LEAF (no children)
    logic: "AND" | "OR" | "N_OF" | "SECTION" | "LEAF";
    // Only for N_OF: how many must be chosen?
    nOf?: number;
    // parent requirementKey (null for top-level sections)
    parent: string | null;
    // children requirementKeys (empty for leaves)
    children: string[];
}