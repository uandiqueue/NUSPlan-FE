import { TagStripMap, LookupTable, RequirementNodeInfo } from "./feValidator";
import { ModuleCode } from "./shared/nusmods-types";
import { CourseInfo, PopulatedProgramPayload } from "./shared/populator";

export interface Progress { 
    have: number; 
    need: number; 
    percent: number; 
}

export interface ValidationSnapshot {
    warnings: string[];
    blocked: Set<ModuleCode>;
    stripped: TagStripMap;
    progress: (feKey: string) => Progress;
}

export interface Choice { boxKey: string; course: CourseInfo; }

export interface ProgrammeSlice {
    payload: PopulatedProgramPayload;
    lookup: LookupTable;
    // FE=>BE key translation dictionaries
    // FE keys (colon‑separated, prefixed by programme id) power the UI tree
    // BE keys (original requirementKey/boxKey) stay intact for FE-BE round‑trips
    fe2be: Record<string, string>;
    picked: Set<ModuleCode>; // Modules selected in this programme
    chosen: Choice[]; // Mapping dropdown-boxKey -> chosen Course
}

export interface PlannerState {
    // Core
    programmes: ProgrammeSlice[]; // one slice per major/minor
    selectedProgramIndex: number; // active tab

    // Derived (from current tab)
    warnings: string[];
    blocked: Set<ModuleCode>;
    progress: (feKey: string) => Progress;
    chosen: Choice[];
    payloads: PopulatedProgramPayload[];
    payload: PopulatedProgramPayload;
    nodeInfo: Record<string, RequirementNodeInfo>;

    // Actions
    loadProgrammes: (
        payloads: PopulatedProgramPayload[],
        lookups: LookupTable[],
        fe2beList: Record<string, string>[]
    ) => void;
    switchProgramme: (index: number) => void;
    toggle: (
        course: CourseInfo,
        boxKey: string,
        requirementKey: string,
        siblings?: string[]
    ) => void;
    canPick: (course: CourseInfo) => boolean;
    isDuplicate: (courseCode: string, boxKey: string) => boolean;
}