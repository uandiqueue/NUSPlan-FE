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

// Simple cache storage
export interface dbCache {
    modules: Map<ModuleCode, ModuleData>;
    paths: Map<string, RequirementPathData>; // pathID -> RequirementPathData (when rendering nested AltPathBox)
    prerequisites: Map<ModuleCode, PrerequisiteRule[]>;
    preclusions: Map<ModuleCode, PreclusionData>;
    gmcs: Map<string, ModuleCode[]>; // gmc_code -> moduleCodes
    isPreloaded: boolean;
}

export interface ModuleData {
    module_code: string;
    title: string;
    module_credit: string;
    description?: string;
    department?: string;
    faculty?: string;
    aliases?: string[];
    prerequisite?: string;
    preclusion?: string;
    semester_data?: any;
}

// Requirement path data from database
export interface RequirementPathData {
    id: string;
    programme_id: string;
    path_key: string;
    parent_path_key?: string;
    display_label: string;
    logic_type: string;
    rule_type?: string;
    rule_value?: number;
    required_units?: number;
    depth: number;
    is_leaf: boolean;
    is_readonly: boolean;
    group_type: string;
    raw_tag_name: string;
    module_codes?: string[];
    module_types?: string[];
    is_overall_source: boolean;
    exception_modules: string[];
}

// GMC mapping data from database
export interface GMCMappingData {
    gmc_code: string;
    gmc_type: string;
    module_code: string;
    programme_id: string;
}

// Prerequisite rule
export interface PrerequisiteRule {
    id: string; // rule id
    module_code: string; // module code this rule belongs to
    rule_type:
        | 'simple' // single module prerequisite
        | 'simple_and' // prerequisite with AND logic and only modules or simple_and children
        | 'complex_and' // prerequisite with AND logic and at least one non-simple_and children
        | 'simple_or' // prerequisite with OR logic and only modules with no children
        | 'complex_or' // prerequisite with OR logic and at least one children
        | 'n_of' // nOf prerequisite
        | 'complex_n_of' // nOf prerequisite with children (NOT FOUND) (extreme complexity)
        | 'wildcard'; // prerequisite with wildcard pattern (e.g. CS21%) (not implemented yet)
    rule_complexity: 
        | 'simple' // simple type
        | 'medium' // non-simple type
        | 'complex'; // complex type (depth > 3, 'complex_n_of' and 'wildcard' types)
    depth: number;
    required_modules: string[] | null;
    children: string[] | null; // children prerequisite rule ids
    quantity_required: number | null; // for nOf rules
    module_pattern: string | null; // for wildcard rules
    grade_required: string[] | null; // required_modules' grades
    original_text: string; // from nusmods
    parent_rule_id: string | null;
}

// Preclusion data
export interface PreclusionData {
    module_code: string;
    precluded_modules: string[];
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
    moduleToBoxMapping: Map<ModuleCode, Set<string>>;
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
    currentUsage?: number; // For double-count decisions
    maxCapacity?: number; // For double-count decisions
    utilizationRate?: number; // For double-count decisions
    prereqModules?: ModuleCode[]; // For prerequisite decisions
    depth?: number; // For nested prerequisite tracking
}

export interface PendingDecision {
    module: ModuleCode;
    boxKey: string;
    type: 'DOUBLE_COUNT_CHOICE' | 'PREREQUISITE_CHOICE';
    options: DecisionOption[];
    maxSelections: number;
    title: string;
    message: string;
    prerequisiteTree?: PrerequisiteTreeNode; // For complex prerequisite visualization
}

// Frontend prerequisite tree (Built by RealtimeValidator)
export interface PrerequisiteTreeNode {
    id: string;
    type: 'AND' | 'OR' | 'N_OF';
    quantity_required?: number; // For N_OF rules
    required_modules?: ModuleCode[]; // Direct modules at this node
    children?: PrerequisiteTreeNode[]; // Child nodes
    depth: number;
    rule_type?: string; // Keep original rule_type for reference
    original_text?: string; // For displaying to user
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