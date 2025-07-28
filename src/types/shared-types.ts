import type { ModuleCode } from "./nusmods-types";

// SHARED TYPES (BE + FE)

export type RequirementGroupType =
    | "commonCore"
    | "coreEssentials" 
    | "coreElectives"
    | "coreSpecials"
    | "coreOthers"
    | "unrestrictedElectives";

export type ProgrammeType = 'major' | 'secondMajor' | 'minor';

// MAIN PAYLOAD 

export interface ProgrammePayload {
    programmeId: string;
    metadata: {
        name: string;
        type: ProgrammeType;
        requiredUnits: number;
        doubleCountCap: number;
    };
    sections: ProgrammeSection[];
    preselectedModules: ModuleCode[];
}

export interface ProgrammeSection {
    groupType: RequirementGroupType;
    displayLabel: string;
    paths: PathInfo[];
    courseBoxes: CourseBox[];
    hidden: CourseBox[]; // Course boxes that are not displayed in the UI (can be added by user manually)
}

// PATH INFORMATION (For FE requirement tracking)

export interface PathInfo {
    pathId: string;
    pathKey: string;
    parentPathKey?: string;
    displayLabel: string;
    logicType: 'AND' | 'OR' | 'LEAF';
    ruleType?: 'min' | 'max';
    ruleValue?: number;
    requiredUnits: number;
    depth: number;
    groupType: RequirementGroupType;
    rawTagName: string; // For FE requirement tracking
}

// COURSE BOXES (UI Components)

export type CourseBox = ExactBox | DropdownBox | AltPathBox;

export interface ExactBox {
    kind: 'exact';
    boxKey: string;
    pathId: string;
    programmeId: string;
    moduleCode: ModuleCode;
    isPreselected: boolean;
    isReadonly?: boolean; // For prerequisites
    isPrerequisite?: boolean; // For prerequisites
    parentModule?: ModuleCode; // For prerequisites
}

export interface DropdownBox {
    kind: 'dropdown';
    boxKey: string;
    pathId: string;
    programmeId: string;
    moduleOptions: ModuleCode[];
    isReadonly?: boolean; // For prerequisites
    isPrerequisite?: boolean; // For prerequisites
    parentModule?: ModuleCode; // For prerequisites
}

export interface AltPathBox {
    kind: 'altPath';
    boxKey: string;
    pathId: string;
    programmeId: string;
    pathAlternatives: CourseBox[]; // List of direct children path IDs
    isReadonly?: boolean; // For prerequisites
    isPrerequisite?: boolean; // For prerequisites
    parentModule?: ModuleCode; // For prerequisites
}

// VALIDATION LOOKUP MAPS (For FE real-time validation)

/**
 * Validation maps containing only combination-specific data
 * that cannot be fetched directly from Supabase by the frontend.
 */
export interface LookupMaps {
    // Combination-specific requirement mappings
    moduleToLeafPaths: Record<ModuleCode, LeafPathMapping[]>;
    leafPathToModules: Record<string, ModuleCode[]>; // pathId -> moduleCodes
    
    // Combination-specific max rule tracking
    moduleToMaxRules: Record<ModuleCode, string[]>; // moduleCode -> pathIds
    
    // Complex combination-specific analysis
    doubleCountEligibility: Record<ModuleCode, DoubleCountInfo>;

    // Path hierarchy mapping
    pathHierarchy: Record<string, Record<string, string[]>>; // programmeId -> {parentPathId: [childPathIds]}

    // Path id <-> path key mapping
    pathIdToKey: Record<string, string>; // pathId -> pathKey
    pathKeyToId: Record<string, string>; // pathKey -> pathId
}

export interface LeafPathMapping {
    pathKey: string;
    pathId: string;
    programmeId: string;
    displayLabel: string;
    groupType: RequirementGroupType;
    rawTagName: string;
    requiredUnits: number;
}

export interface DoubleCountInfo {
    // Cross-programme opportunities (across different programmes)
    crossProgrammeEligible: boolean;
    crossProgrammePaths: LeafPathMapping[];
    
    // Intra-programme opportunities (commonCore + other within same programme)
    intraProgrammeEligible: boolean;
    intraProgrammePaths: LeafPathMapping[];
    
    // All eligible paths for "R" tag display
    allEligiblePaths: LeafPathMapping[];
    
    // Summary for frontend processing
    maxPossibleDoubleCount: number; // 0, 1, or 2
    eligibleProgrammes: string[]; // Programme IDs where this module can count
}

// REQUEST/RESPONSE INTERFACES
export interface BackendResponse<T> {
  success: boolean;
  data: T;
  metadata?: any;
}

export interface ProcessProgrammesRequest {
    programmeIds: string[];
    userId?: string;
}

export interface ProcessProgrammesResponse {
    programmes: ProgrammePayload[];
    lookup: LookupMaps;
    globalValidation: ValidationResult;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

export interface ValidationError {
    type: 
    | 'INVALID_PROGRAMME_COMBINATION' 
    | 'HARD_CONFLICT' 
    | 'GMC_MAPPING_FAILED' 
    | 'OTHERS';
    message: string;
    programmeIds?: string[];
    moduleCode?: ModuleCode;
    pathId?: string;
}

// PROCESSING ORDER

export const PROCESSING_ORDER: RequirementGroupType[] = [
    'coreEssentials',
    'coreOthers', 
    'coreSpecials',
    'commonCore',
    'coreElectives'
    // unrestrictedElectives calculated dynamically
];