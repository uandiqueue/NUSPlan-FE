import { ModuleCode } from "./shared/nusmods-types";
import { CapRule } from "./shared/populator";
import { LookupPayload } from "./shared/validator";

export interface LookupTable extends LookupPayload {
    // requirementKey -> number of units required
    requiredUnits: Record<string, number>;
    // requirementKey -> array of moduleCodes that may fulfil it (reversed lookup of requirementsByModule)
    modulesByRequirement: Record<string, ModuleCode[]>;
    // moduleCode -> array of FE requirementKeys which include logics and uses ":" as separator
    requirementsByModule: Record<ModuleCode, string[]>;
    // requirementKey -> logic/children/parent key
    nodeInfo: Record<string, RequirementNodeInfo>;
    // LookupPayload fields (tags, units, etc.) are inherited
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

// Max cap
export type TagStripMap = Record<ModuleCode, string[]>;
export interface Usage {
    used: number;
    max: number;
    rule: CapRule;
}