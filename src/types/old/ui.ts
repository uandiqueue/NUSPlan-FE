import { TagStripMap, LookupTable, RequirementNodeInfo } from "./feValidator";
import { ModuleCode } from "../nusmods-types";
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

export interface Choice { boxKey: string; course: CourseInfo; kind: "exact" | "dropdown" | "altPath"; }

export interface ProgrammeSlice {
    payload: PopulatedProgramPayload;
    lookup: LookupTable;
    fe2be: Record<string, string>; // REDUNDANT ancient relics (not yet optimised out)
    picked: Set<ModuleCode>; // Modules selected in this programme
    chosen: Choice[]; // Mapping dropdown-boxKey -> chosen Course
}

export interface PlannerState {
    programmes: ProgrammeSlice[]; // one slice per major/minor
    selectedProgramIndex: number; // active tab
    // Derived (from programmes)
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
        kind: "exact" | "dropdown" | "altPath",
        siblings?: string[]
    ) => void;
    canPick: (course: CourseInfo) => boolean;
    isDuplicate: (courseCode: string, boxKey: string) => boolean;
}