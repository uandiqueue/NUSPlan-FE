import { ModuleCode } from "./shared/nusmods-types";
import { LookupPayload, TagMap, UnitMap, PrereqMap, PreclusionMap, MaxMap } from "./shared/validator";

export interface LookupTable extends LookupPayload {
    // requirementKey -> number of units required
    requiredUnits: Record<string, number>;
    // requirementKey -> array of moduleCodes that may fulfil it (reversed lookup of requirementsByModule)
    modulesByRequirement: Record<string, ModuleCode[]>;
    // moduleCode -> array of FE requirementKeys which include logics and uses ":" as separator
    requirementsByModule: Record<ModuleCode, string[]>;
    // requirementKey -> logic/children/parent key
    nodeInfo: Record<string, RequirementNodeInfo>;
    // moduleCode -> array of BE requirementKeys it can fulfil (from BE, uses "-" as separator)
    tags: TagMap;
    // moduleCode -> units of a course
    units: UnitMap;
    // moduleCode -> prerequisite tree
    prereqs: PrereqMap;
    // moduleCode -> array of precluded modules
    preclusions: PreclusionMap;
    // moduleCode -> list of max requirementKeys/maxRuleTags
    maxRequirements: MaxMap;
    // Selected modules by default or user
    selected: ModuleCode[];
    version: number;
}

export type Logic = 'AND' | 'OR' | 'N_OF' | 'LEAF' | 'SECTION';
export interface RequirementNodeInfo {
    // AND / OR / N_OF / SECTION (Top-level) / LEAF (no children)
    logic: Logic;
    // Only for N_OF: how many must be chosen?
    nOf?: number;
    // parent requirementKey (null for top-level sections)
    parent: string | null;
    // children requirementKeys (empty for leaves)
    children: string[];
    // human-readable title for the requirement (for UI)
    title: string;
}