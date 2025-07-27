import type { ProgrammePayload, LookupMaps, CourseBox } from '../types/shared-types';
import type { ModuleCode } from '../types/nusmods-types';
import type { 
    ValidationState, 
    ValidationResult, 
    PrerequisiteRule,
    DecisionOption,
    PendingDecision,
    RequirementPathData
} from '../types/frontend-types';
import { dbService } from './dbQuery';

export class RealtimeValidator {
    private validationState: ValidationState;
    private lookupMaps: LookupMaps;
    private programmes: any[];

    // Prerequisite-related properties
    private prerequisiteBoxes?: Map<ModuleCode, CourseBox[]>;
    private prerequisiteDecisions?: Map<ModuleCode, PendingDecision>;
    private prerequisiteFulfillment?: Map<string, { fulfilled: boolean; selectedModule?: ModuleCode }>;
    private cachedRuleMap?: Map<string, PrerequisiteRule>;

    constructor(
        validationState: ValidationState, 
        lookupMaps: LookupMaps, 
        programmes: ProgrammePayload[]
    ) {
        this.validationState = validationState;
        this.lookupMaps = lookupMaps;
        this.programmes = programmes;

        // Preload module data when validator is initialized
        this.preloadModuleData();
    }

    /**
     * Preload module data for all modules in the academic plan
     * This improves validation performance by caching frequently used module information
     */
    private async preloadModuleData(): Promise<void> {
        try {
            // Collect all unique modules from lookup maps
            const allModules = new Set<ModuleCode>();

            // Add modules from module-to-leaf-paths mapping
            Object.keys(this.lookupMaps.moduleToLeafPaths).forEach(moduleCode => {
                allModules.add(moduleCode as ModuleCode);
            });

            console.log(`Preloading ${allModules.size} modules for validation...`);

            // Preload modules in the database service (just in case, should be preloaded after programme selection)
            await dbService.preloadModules(Array.from(allModules));

            console.log('Module preloading completed');
        } catch (error) {
            console.error('Error preloading module data:', error);
            // Don't fail validation if preloading fails - validation will still work with individual requests
        }
    }

    /**
     * Main validation entry point called after a module is selected or deselected.
     */
    async validateSelection(module: ModuleCode, boxKey: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            requiresDecision: false
        };

        // 1. Triple count violation check
        const tripleCountResult = await this.checkTripleCountViolation(module);
        if (!tripleCountResult.isValid) {
            return tripleCountResult;
        }

        // 2. Prerequisite checking
        const prereqResult = await this.checkPrerequisites(module);
        result.warnings.push(...prereqResult.warnings);
        if (prereqResult.requiresDecision) {
            result.requiresDecision = true;
        }

        // 3. Max rule checking
        const maxRuleResult = await this.checkMaxRules(module, boxKey);
        result.warnings.push(...maxRuleResult.warnings);

        // 4. Double count tracking
        const doubleCountResult = await this.checkDoubleCount(module, boxKey);
        if (doubleCountResult.requiresDecision) {
            result.requiresDecision = true;
        }
        result.warnings.push(...doubleCountResult.warnings);

        return result;
    }

    /**
     * Prerequisite checking logic
     * 
     * Rule: Each module may have prerequisites that must be satisfied if it is to be selected.
     */
    private async checkPrerequisites(module: ModuleCode): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            requiresDecision: false
        };

        try {
            // Fetch all prerequisite rules for this module
            const prereqRules = await dbService.getModulePrerequisites(module);
            if (prereqRules.length === 0) {
                return result;
            }
            const ruleMap = new Map<string, PrerequisiteRule>();
            prereqRules.forEach(rule => ruleMap.set(rule.id, rule));
            this.cachedRuleMap = ruleMap;

            // Find all depth 1 rules (root level prerequisites) and process to collect course boxes
            const rootRules = prereqRules.filter(rule => rule.depth === 1);
            const allPrereqBoxes: CourseBox[] = [];
            const decisionOptions: DecisionOption[] = [];
            for (const rootRule of rootRules) {
                const processed = await this.processPrerequisiteRule(
                    rootRule, 
                    ruleMap, 
                    1
                );
                if (processed.requiresDecision && processed.decisionOptions) {
                    // Complex OR requires user decision
                    decisionOptions.push(...processed.decisionOptions);
                    result.requiresDecision = true;
                } else {
                    // Direct course boxes to add
                    allPrereqBoxes.push(...processed.boxes);
                }
            }

            // Store prerequisite boxes for optimizer to render
            if (allPrereqBoxes.length > 0) {
                await this.storePrerequisiteBoxes(module, allPrereqBoxes);
                // Just inform that prerequisites exist
                result.warnings.push(`${module} has prerequisites that will be added automatically`);
            }

            // Handle decision requirements
            if (decisionOptions.length > 0) {
                result.requiresDecision = true;
                await this.storePrerequisiteDecisions(module, decisionOptions);
            }

        } catch (error) {
            console.error(`Error checking prerequisites for ${module}:`, error);
            result.warnings.push(`Could not verify prerequisites for ${module}`);
        }

        return result;
    }

    /**
     * Process a single prerequisite rule and convert to CourseBox structures
     */
    private async processPrerequisiteRule(
        rule: PrerequisiteRule,
        ruleMap: Map<string, PrerequisiteRule>,
        depth: number
    ): Promise<{ 
        boxes: CourseBox[]; 
        requiresDecision: boolean; 
        decisionOptions?: DecisionOption[] 
    }> {
        switch (rule.rule_type) {
            case 'simple':
                // 'simple' -> ExactBox
                if (rule.required_modules && rule.required_modules.length > 0) {
                    const moduleCode = rule.required_modules[0] as ModuleCode;
                    return {
                        boxes: [{
                            kind: 'exact',
                            boxKey: `prereq-${rule.id}-${moduleCode}`,
                            pathId: `prereq-${rule.id}`,
                            programmeId: 'prereq', // Special programme ID for prerequisites
                            moduleCode,
                            isPreselected: false,
                            isReadonly: true,
                            isPrerequisite: true,
                            parentModule: rule.module_code as ModuleCode
                        }],
                        requiresDecision: false
                    };
                }
                break;

            case 'simple_and':
                // 'simple_and' -> multiple ExactBoxes
                if (rule.required_modules) {
                    const boxes: CourseBox[] = rule.required_modules.map(mod => ({
                        kind: 'exact' as const,
                        boxKey: `prereq-${rule.id}-${mod}`,
                        pathId: `prereq-${rule.id}`,
                        programmeId: 'prereq',
                        moduleCode: mod as ModuleCode,
                        isPreselected: false,
                        isReadonly: true,
                        isPrerequisite: true,
                        parentModule: rule.module_code as ModuleCode
                    }));
                    return { boxes, requiresDecision: false };
                }
                break;

            case 'simple_or':
                // 'simple_or' -> DropdownBox
                if (rule.required_modules && rule.required_modules.length > 0) {
                    return {
                        boxes: [{
                            kind: 'dropdown',
                            boxKey: `prereq-${rule.id}-dropdown`,
                            pathId: `prereq-${rule.id}`,
                            programmeId: 'prereq',
                            moduleOptions: rule.required_modules.map(m => m as ModuleCode),
                            isReadonly: true,
                            isPrerequisite: true,
                            parentModule: rule.module_code as ModuleCode
                        }],
                        requiresDecision: false
                    };
                }
                break;

            case 'n_of':
                // 'n_of' -> n DropdownBoxes
                if (rule.required_modules && rule.quantity_required) {
                    const boxes: CourseBox[] = [];
                    for (let i = 0; i < rule.quantity_required; i++) {
                        boxes.push({
                            kind: 'dropdown',
                            boxKey: `prereq-${rule.id}-dropdown-${i}`,
                            pathId: `prereq-${rule.id}`,
                            programmeId: 'prereq',
                            moduleOptions: rule.required_modules.map(m => m as ModuleCode),
                            isReadonly: true,
                            isPrerequisite: true,
                            parentModule: rule.module_code as ModuleCode
                        });
                    }
                    return { boxes, requiresDecision: false };
                }
                break;

            case 'complex_and':
                // 'complex_and' -> All children must be fulfilled
                if (rule.children) {
                    const allChildBoxes: CourseBox[] = [];
                    const childDecisions: DecisionOption[] = [];
                    
                    for (const childId of rule.children) {
                        const childRule = ruleMap.get(childId);
                        if (!childRule) continue;
                        
                        const childResult = await this.processPrerequisiteRule(
                            childRule, 
                            ruleMap, 
                            depth + 1
                        );
                        
                        if (childResult.requiresDecision && childResult.decisionOptions) {
                            // complex_or child requires decision
                            childDecisions.push(...childResult.decisionOptions);
                        } else {
                            // Add child boxes directly
                            allChildBoxes.push(...childResult.boxes);
                        }
                    }
                    
                    // If any child requires decision, bubble it up
                    if (childDecisions.length > 0) {
                        return {
                            boxes: allChildBoxes,
                            requiresDecision: true,
                            decisionOptions: childDecisions
                        };
                    }
                    
                    return { boxes: allChildBoxes, requiresDecision: false };
                }
                break;

            case 'complex_or':
                // 'complex_or' -> Decision required
                if (rule.children) {
                    const options: DecisionOption[] = [];
                    
                    for (const childId of rule.children) {
                        const childRule = ruleMap.get(childId);
                        if (!childRule) continue;
                        
                        const childResult = await this.processPrerequisiteRule(
                            childRule, 
                            ruleMap, 
                            depth + 1
                        );
                        
                        // Create decision option for this path
                        options.push({
                            id: childRule.id,
                            label: `${childRule.module_code as string} Prerequisite Option`,
                            description: childRule.original_text || 'Complete this prerequisite path',
                            prereqModules: childResult.boxes,
                            depth: depth + 1
                        });
                    }
                    
                    return {
                        boxes: [], // No direct boxes, requires decision
                        requiresDecision: true,
                        decisionOptions: options
                    };
                }
                break;
        }
        // Fallback
        return { boxes: [], requiresDecision: false };
    }

    /**
     * Store prerequisite boxes for the optimizer to render
     */
    private async storePrerequisiteBoxes(
        module: ModuleCode, 
        boxes: CourseBox[]
    ): Promise<void> {
        if (!this.prerequisiteBoxes) {
            this.prerequisiteBoxes = new Map();
        }
        this.prerequisiteBoxes.set(module, boxes);
    }

    /**
     * Store prerequisite decisions for UI presentation
     */
    private async storePrerequisiteDecisions(
        module: ModuleCode,
        options: DecisionOption[]
    ): Promise<void> {
        if (!this.prerequisiteDecisions) {
            this.prerequisiteDecisions = new Map();
        }
        this.prerequisiteDecisions.set(module, {
            module,
            boxKey: '', // Set by calling context
            type: 'PREREQUISITE_CHOICE',
            options,
            maxSelections: 1,
            title: `Choose prerequisite path for ${module}`,
            message: 'This module has multiple prerequisite options. Please select one:'
        } as PendingDecision);
    }

    /**
     * Apply prerequisite decision
     */
    async applyPrerequisiteDecision(
        module: ModuleCode, 
        selectedOptionId: string
    ): Promise<CourseBox[]> {
        const decision = this.prerequisiteDecisions?.get(module);
        if (!decision) return [];
        
        const selectedOption = decision.options.find(opt => opt.id === selectedOptionId);
        if (!selectedOption) return [];
        
        // Re-process the selected rule to get its boxes
        const selectedRule = this.getCachedRule(selectedOptionId);
        if (!selectedRule) return [];
        
        const processed = await this.processPrerequisiteRule(
            selectedRule,
            this.getCachedRuleMap(),
            selectedRule.depth
        );
        
        // Store the resolved boxes
        await this.storePrerequisiteBoxes(module, processed.boxes);
        
        // Clear the decision
        this.prerequisiteDecisions?.delete(module);
        
        return processed.boxes;
    }

    /**
     * Mark prerequisite as fulfilled when selected
     */
    async markPrerequisiteFulfilled(boxKey: string, selectedModule?: ModuleCode): Promise<void> {
        if (!this.prerequisiteFulfillment) {
            this.prerequisiteFulfillment = new Map();
        }
        this.prerequisiteFulfillment.set(boxKey, {
            fulfilled: true,
            selectedModule
        });
    }

    isPrerequisiteFulfilled(boxKey: string): boolean {
        return this.prerequisiteFulfillment?.get(boxKey)?.fulfilled || false;
    }

    /**
     * Get prerequisite boxes for a module
     */
    getPrerequisiteBoxes(module: ModuleCode): CourseBox[] | undefined {
        return this.prerequisiteBoxes?.get(module);
    }

    /**
     * Get prerequisite decisions
     */
    getPrerequisiteDecisions(module: ModuleCode): PendingDecision | undefined {
        return this.prerequisiteDecisions?.get(module);
    }

    /**
     * Max Rule Stripping Logic
     * 
     * Rule: If a LEAF requirement path has a max cap, once that cap is reached,
     * all associated modules will have their tags dulled only in that path's context.
     * The path's context means all the paths that share the same parent pathKey as 
     * the max rule path will be affected.
     */
    private async checkMaxRules(module: ModuleCode, boxKey: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            requiresDecision: false
        };

        try {
            const maxRuleIds = this.lookupMaps.moduleToMaxRules[module] || [];
            const moduleAU = await dbService.getModuleAU(module);

            for (const maxRuleId of maxRuleIds) {
                const currentFulfilled = this.validationState.maxRuleFulfillment.get(maxRuleId) || 0;
                const maxRule = await dbService.getRequirementPathById(maxRuleId) as RequirementPathData;
                if (!maxRule) throw new Error(`Max rule ${maxRuleId} not found`);

                // Check if adding this module would exceed the cap
                if (maxRule && typeof maxRule.rule_value === 'number'
                        && currentFulfilled + moduleAU > maxRule.rule_value
                ) {
                    // Cap reached - strip tags for this path context
                    this.stripTagForPath(module, maxRuleId);

                    const affectedModules = this.getModulesForMaxRule(maxRuleId);
                    affectedModules.forEach(affectedModule => {
                        this.stripTagForPath(affectedModule, maxRuleId);
                    });

                    result.warnings.push(
                        `${maxRule.display_label} (${maxRule.rule_value} units cap reached)`
                    );
                }
            }
        } catch (error) {
            console.error(`Error checking max rules for ${module}:`, error);
            result.errors.push(`Could not verify max rule for ${module}`);
        }

        return result;
    }

    /**
     * Strip tag for a specific path context
     */
    private stripTagForPath(module: ModuleCode, pathId: string): void {
        if (!this.validationState.strippedTags.has(module)) {
            this.validationState.strippedTags.set(module, new Set());
        }
        this.validationState.strippedTags.get(module)!.add(pathId);
    }

    /**
     * Double Count Tracking Logic
     * 
     * Rule: Each programme has a defined doubleCountCap. Once reached, no more modules
     * can double-count into that programme, though they may still count elsewhere.
     */
    private async checkDoubleCount(module: ModuleCode, boxKey: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            requiresDecision: false
        };

        const doubleCountInfo = this.lookupMaps.doubleCountEligibility[module];
        if (!doubleCountInfo || doubleCountInfo.maxPossibleDoubleCount === 0) {
            return result;
        }

        const moduleAU = await dbService.getModuleAU(module);
        const eligibleProgrammes = doubleCountInfo.eligibleProgrammes;
        const availableProgrammes: string[] = [];

        // Check which programmes can still accept this module for double counting
        for (const programmeId of eligibleProgrammes) {
            const currentUsage = this.validationState.doubleCountUsage.get(programmeId) || 0;
            const programme = this.getProgramme(programmeId);

            if (programme && currentUsage + moduleAU <= programme.metadata.doubleCountCap) {
                availableProgrammes.push(programmeId);
            }
        }

        // Check for intra-programme double count (commonCore only)
        const hasIntraProgrammeEligibility = doubleCountInfo.intraProgrammeEligible;
        if (hasIntraProgrammeEligibility) {
            const targetGroupType = this.getGroupTypeFromBoxKey(boxKey);
            const hasCommonCore = doubleCountInfo.intraProgrammePaths.some(
                path => path.groupType === 'commonCore'
            );

            if (hasCommonCore && targetGroupType !== 'commonCore') {
                result.warnings.push(
                    `${module} can double-count within the same programme (commonCore + ${targetGroupType})`
                );
            }
        }

        // Determine if user decision is required
        if (availableProgrammes.length > 1 ||
            (availableProgrammes.length === 1 && hasIntraProgrammeEligibility)) {
            result.requiresDecision = true;
        }

        // Update internal tracking for this module
        if (availableProgrammes.length > 0) {
            this.validationState.doubleCountModules.set(module, availableProgrammes);
        }

        return result;
    }

    /**
     * Triple Count Violation Logic
     * 
     * Rule: A module may fulfill at most 2 requirements, including both
     * intra- and inter-programme rules.
     */
    private async checkTripleCountViolation(module: ModuleCode): Promise<ValidationResult> {
        const currentUsage = this.validationState.moduleUsageCount.get(module) || 0;
        if (currentUsage >= 2) {
            // Record as violating module
            this.validationState.violatingModules.add(module);
            return {
                isValid: false,
                errors: [`${module} is already used in 2 requirements (maximum allowed)`],
                warnings: [],
                requiresDecision: false,
                blockedReason: 'TRIPLE_COUNT_PREVENTED'
            };
        }

        return {
            isValid: true,
            errors: [],
            warnings: [],
            requiresDecision: false
        };
    }

    /**
     * Update validation state after a successful selection
     */
    async updateValidationState(module: ModuleCode, boxKey: string, action: 'ADD' | 'REMOVE'): Promise<void> {
        if (action === 'ADD') {
            await this.addModuleToValidationState(module, boxKey);
        } else {
            await this.removeModuleFromValidationState(module, boxKey);
        }
    }

    private async addModuleToValidationState(module: ModuleCode, boxKey: string): Promise<void> {
        const moduleAU = await dbService.getModuleAU(module);

        // Update usage count
        const currentUsage = this.validationState.moduleUsageCount.get(module) || 0;
        this.validationState.moduleUsageCount.set(module, currentUsage + 1);

        // Update max rule fulfillment
        const maxRuleIds = this.lookupMaps.moduleToMaxRules[module] || [];
        for (const maxRuleId of maxRuleIds) {
            const currentFulfilled = this.validationState.maxRuleFulfillment.get(maxRuleId) || 0;
            this.validationState.maxRuleFulfillment.set(maxRuleId, currentFulfilled + moduleAU);
        }

        // Update double count usage (set by decision dialog)
        const allocatedProgrammes = this.validationState.doubleCountModules.get(module) || [];
        for (const programmeId of allocatedProgrammes) {
            const currentUsage = this.validationState.doubleCountUsage.get(programmeId) || 0;
            this.validationState.doubleCountUsage.set(programmeId, currentUsage + moduleAU);
        }

        // Add to selected modules
        this.validationState.selectedModules.add(module);

        let boxSet = this.validationState.moduleToBoxMapping.get(module);
        if (!boxSet) {
            boxSet = new Set<string>();
        }
        boxSet.add(boxKey);
        this.validationState.moduleToBoxMapping.set(module, boxSet);
    }


    private async removeModuleFromValidationState(module: ModuleCode, boxKey: string): Promise<void> {
        try {
            const moduleAU = await dbService.getModuleAU(module);

            // Update usage count
            const currentUsage = this.validationState.moduleUsageCount.get(module) || 0;
            const newUsage = Math.max(0, currentUsage - 1);
            this.validationState.moduleUsageCount.set(module, newUsage);

            // Remove from violating modules if no longer violating
            if (newUsage < 2) {
                this.validationState.violatingModules.delete(module);
            }

            // Update max rule fulfillment
            const maxRuleIds = this.lookupMaps.moduleToMaxRules[module] || [];
            for (const maxRuleId of maxRuleIds) {
                const currentFulfilled = this.validationState.maxRuleFulfillment.get(maxRuleId) || 0;
                const newFulfilled = Math.max(0, currentFulfilled - moduleAU);
                this.validationState.maxRuleFulfillment.set(maxRuleId, newFulfilled);

                // Restore tags if max rule is no longer exceeded
                const maxRule = await dbService.getRequirementPathById(maxRuleId);
                if (maxRule && typeof maxRule.rule_value === 'number' && newFulfilled <= maxRule.rule_value) {
                    this.restoreTagForPath(module, maxRuleId);
                } else {
                    throw new Error(`Max rule ${maxRuleId} not found or invalid`);
                }
            }

            const boxSet = this.validationState.moduleToBoxMapping.get(module);
            if (boxSet) {
                boxSet.delete(boxKey);
                if (boxSet.size === 0) {
                    this.validationState.moduleToBoxMapping.delete(module);
                    // Optionally also remove from selectedModules if not selected elsewhere:
                    // this.validationState.selectedModules.delete(module);
                } else {
                    this.validationState.moduleToBoxMapping.set(module, boxSet);
                }
            }
        } catch (error) {
            console.error(`Error removing module ${module} from validation state:`, error);
        }
    }

    /**
     * Restore tag for a specific path context
     */
    private restoreTagForPath(module: ModuleCode, pathId: string): void {
        const strippedTags = this.validationState.strippedTags.get(module);
        if (strippedTags) {
            strippedTags.delete(pathId);
            if (strippedTags.size === 0) {
                this.validationState.strippedTags.delete(module);
            }
        }
    }

    /**
     * Apply double count decision from user
     */
    async applyDoubleCountDecision(module: ModuleCode, selectedProgrammes: string[]): Promise<void> {
        this.validationState.doubleCountModules.set(module, selectedProgrammes);

        const moduleAU = await dbService.getModuleAU(module);
        for (const programmeId of selectedProgrammes) {
            const currentUsage = this.validationState.doubleCountUsage.get(programmeId) || 0;
            this.validationState.doubleCountUsage.set(programmeId, currentUsage + moduleAU);
        }
    }

    // HELPERS

    /**
     * Get cached prerequisite rule map
     */
    private getCachedRuleMap(): Map<string, PrerequisiteRule> {
        return this.cachedRuleMap || new Map();
    }

    /**
     * Get cached prerequisite rule by ID
     */
    private getCachedRule(ruleId: string): PrerequisiteRule | undefined {
        return this.cachedRuleMap?.get(ruleId);
    }

    private getModulesForMaxRule(maxRuleId: string): ModuleCode[] {
        // Return all modules that are affected by this max rule
        const leafModules = this.lookupMaps.leafPathToModules[maxRuleId] || [];
        return leafModules;
    }

    private getProgramme(programmeId: string): any {
        return this.programmes.find(p => p.programmeId === programmeId);
    }

    private getGroupTypeFromBoxKey(boxKey: string): string {
        // Extract group type from box key naming convention
        return boxKey.split('-')[0] || '';
    }

    // Getters for optimizer to access validation state
    getStrippedTags(): Map<ModuleCode, Set<string>> {
        return this.validationState.strippedTags;
    }

    getDoubleCountUsage(): Map<string, number> {
        return this.validationState.doubleCountUsage;
    }

    getViolatingModules(): Set<ModuleCode> {
        return this.validationState.violatingModules;
    }

    getDoubleCountModules(): Map<ModuleCode, string[]> {
        return this.validationState.doubleCountModules;
    }

    getSelectedModules(): Set<ModuleCode> {
        return this.validationState.selectedModules;
    }

    /**
     * For debugging
     */
    getValidationStats(): {
        selectedModules: number;
        violatingModules: number;
        maxRulesFulfilled: number;
    } {
        return {
            selectedModules: this.validationState.selectedModules.size,
            violatingModules: this.validationState.violatingModules.size,
            maxRulesFulfilled: this.validationState.maxRuleFulfillment.size
        };
    }
}