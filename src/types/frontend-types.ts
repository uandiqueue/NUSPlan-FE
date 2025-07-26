import type { ModuleCode } from '../types/nusmods-types';
import type { ProgrammePayload, LookupMaps } from './shared-types';

// PROGRAMME SELECTION INTERFACES

export interface Programme {
    id: string;
    name: string;
    type: 'major' | 'secondMajor' | 'minor';
    required_units: number;
    double_count_cap: number;
}

export interface ProgrammeSelection {
    id: string;
    name: string;
}
// DATABASE INTERFACES

// Frontend module data
export interface FEModuleData {
    moduleCode: ModuleCode;
    title: string;
    moduleUnit: number;
    description?: string;
    department?: string;
    faculty?: string;
}

// Frontend prerequisite data
export interface FEPrerequisiteData {
    moduleCode: ModuleCode;
    requiredModules: ModuleCode[];
}

// Frontend preclusion data
export interface FEPreclusionData {
    moduleCode: ModuleCode;
    precludedModules: ModuleCode[];
}

// Cached module information
export interface CachedModuleInfo {
    moduleCode: ModuleCode;
    title: string;
    moduleUnit: number;
    description?: string;
    department?: string;
    faculty?: string;
    timestamp: number; // For cache expiry
}

// PlannerStore INTERFACES

// FE Realtime-Validator
export interface ValidationState {
    // Max rule tracking
    maxRuleFulfillment: Map<string, number>; // maxRuleId -> fulfilled AU
    strippedTags: Map<ModuleCode, Set<string>>; // module -> stripped pathKeys
    
    // Double count tracking
    doubleCountUsage: Map<string, number>; // programmeId -> used AU
    doubleCountModules: Map<ModuleCode, string[]>; // module -> programmes it's counted for
    
    // Triple count tracking
    moduleUsageCount: Map<ModuleCode, number>; // module -> times used
    violatingModules: Set<ModuleCode>; // modules that would cause triple count
    
    // General tracking
    selectedModules: Set<ModuleCode>;
    moduleToBoxMapping: Map<ModuleCode, string>;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    requiresDecision: boolean; // if true, user must make a choice
    blockedReason?: string;
}

// FE Optimizer
export interface ModuleTag {
    type: 'R' | 'D';
    labels: TagLabel[];
    isVisible: boolean;
    isFaded: boolean; // True when all labels are dulled
}

export interface TagLabel {
    text: string; // Display text (e.g., "ML Elective", "CS -- coreElectives")
    pathKey?: string; // Associated requirement path (for R tags)
    programmeId?: string; // Associated programme (for D tags)
    isDulled: boolean; // Whether this specific label is dulled
    isHighlighted: boolean; // For max cap warnings (red highlight)
    context: string; // Additional context for tooltips
}

export interface DecisionOption {
    id: string;
    label: string;
    description: string;
    currentUsage: number;
    maxCapacity: number;
    utilizationRate: number;
}

export interface PendingDecision {
    module: ModuleCode;
    boxKey: string;
    type: 'DOUBLE_COUNT_CHOICE'; // Only double count decision required for now
    options: DecisionOption[];
    maxSelections: number;
    title: string;
    message: string;
}

// FE Progress-Tracker
export interface RequirementNode {
    pathKey: string;
    displayLabel: string;
    requiredAU: number;
    fulfilledAU: number;
    children: RequirementNode[];
    isLeaf: boolean;
    groupType: string;
    depth: number;
    progressPercentage: number;
    status: 'not_started' | 'in_progress' | 'completed' | 'exceeded';
    modules: ModuleCode[]; // Modules contributing to this requirement
}

export interface ProgressState {
    // pathKey -> fulfilled AU
    pathFulfillment: Map<string, number>;

    // pathKey -> contributing modules
    pathModules: Map<string, ModuleCode[]>;
    
    // Programme-level progress
    programmeProgress: Map<string, {
        totalRequired: number;
        totalFulfilled: number;
        coreAU: number;
        ueAU: number;
    }>;
    
    // UE calculation for major programme
    ueCalculation: {
        required: number;
        fulfilled: number;
        autoIncludedModules: ModuleCode[];
        overflow: number;
    };
}