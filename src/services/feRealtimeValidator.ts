import type { LookupMaps } from '../types/shared-types';
import type { ModuleCode } from '../types/nusmods-types';
import type { ValidationState, ValidationResult } from '../types/frontend-types';
import { dbService } from './dbQuery';

export class RealtimeValidator {
    private validationState: ValidationState;
    private lookupMaps: LookupMaps;
    private programmes: any[];

    // Cache for module AUs to avoid repeated database calls during validation
    private moduleAUCache = new Map<ModuleCode, number>();

    constructor(validationState: ValidationState, lookupMaps: LookupMaps, programmes: any[]) {
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

            // Add modules from leaf-path-to-modules mapping
            Object.values(this.lookupMaps.leafPathToModules).forEach(modules => {
                modules.forEach(moduleCode => allModules.add(moduleCode));
            });

            console.log(`Preloading ${allModules.size} modules for validation...`);

            // Preload modules in the database service (this will cache them)
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

        // 2. Max rule checking
        const maxRuleResult = await this.checkMaxRules(module, boxKey);
        result.warnings.push(...maxRuleResult.warnings);

        // 3. Double count tracking
        const doubleCountResult = await this.checkDoubleCount(module, boxKey);
        if (doubleCountResult.requiresDecision) {
            result.requiresDecision = true;
        }
        result.warnings.push(...doubleCountResult.warnings);

        return result;
    }

    /**
     * 1. Max Rule Stripping Logic
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

        const maxRuleIds = this.lookupMaps.moduleToMaxRules[module] || [];
        const moduleAU = await this.getModuleAU(module);

        for (const maxRuleId of maxRuleIds) {
            const currentFulfilled = this.validationState.maxRuleFulfillment.get(maxRuleId) || 0;
            const maxRule = this.getMaxRule(maxRuleId);

            if (!maxRule) continue;

            // Check if adding this module would exceed the cap
            if (currentFulfilled + moduleAU > maxRule.maxUnits) {
                // Cap reached - strip tags for this path context
                const pathKey = this.extractPathKeyFromMaxRule(maxRuleId);
                this.stripTagForPath(module, pathKey);

                // Strip tags for all other modules in this max rule
                const affectedModules = this.getModulesForMaxRule(maxRuleId);
                affectedModules.forEach(affectedModule => {
                    this.stripTagForPath(affectedModule, pathKey);
                });

                result.warnings.push(
                    `Module will not count toward ${maxRule.displayLabel} (${maxRule.maxUnits} AU cap reached)`
                );
            }
        }

        return result;
    }

    /**
     * Strip tag for a specific path context
     */
    private stripTagForPath(module: ModuleCode, pathKey: string): void {
        if (!this.validationState.strippedTags.has(module)) {
            this.validationState.strippedTags.set(module, new Set());
        }
        this.validationState.strippedTags.get(module)!.add(pathKey);
    }

    /**
     * 2. Double Count Tracking Logic
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

        const moduleAU = await this.getModuleAU(module);
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

        // Check for intra-programme double count (CommonCore only)
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
     * 3. Triple Count Violation Logic
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
        const moduleAU = await this.getModuleAU(module);

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
        const moduleAU = await this.getModuleAU(module);

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
            const maxRule = this.getMaxRule(maxRuleId);
            if (maxRule && newFulfilled <= maxRule.maxUnits) {
                const pathKey = this.extractPathKeyFromMaxRule(maxRuleId);
                this.restoreTagForPath(module, pathKey);
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
    }


    /**
     * Restore tag for a specific path context
     */
    private restoreTagForPath(module: ModuleCode, pathKey: string): void {
        const strippedTags = this.validationState.strippedTags.get(module);
        if (strippedTags) {
            strippedTags.delete(pathKey);
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

        const moduleAU = await this.getModuleAU(module);
        for (const programmeId of selectedProgrammes) {
            const currentUsage = this.validationState.doubleCountUsage.get(programmeId) || 0;
            this.validationState.doubleCountUsage.set(programmeId, currentUsage + moduleAU);
        }
    }

    // Helper methods with database integration

    /**
     * Get module AU with caching and database fallback
     */
    private async getModuleAU(module: ModuleCode): Promise<number> {
        // Check local cache first
        if (this.moduleAUCache.has(module)) {
            return this.moduleAUCache.get(module)!;
        }

        // Fallback to database
        try {
            const au = await dbService.getModuleAU(module);
            this.moduleAUCache.set(module, au);
            return au;
        } catch (error) {
            console.error(`Error fetching AU for ${module}:`, error);
            // Final fallback to 4 AU
            this.moduleAUCache.set(module, 4);
            return 4;
        }
    }

    private getMaxRule(maxRuleId: string): any {
        // Implementation would fetch max rule details from lookup maps
        // For now, return mock data - this should be enhanced with actual lookup map data
        return {
            maxUnits: 12,
            displayLabel: 'Level 3000+',
            pathKey: maxRuleId.replace(/_max.*/, '')
        };
    }

    private extractPathKeyFromMaxRule(maxRuleId: string): string {
        return maxRuleId.replace(/_max.*/, '');
    }

    private getModulesForMaxRule(maxRuleId: string): ModuleCode[] {
        // Return all modules that are affected by this max rule
        const pathKey = this.extractPathKeyFromMaxRule(maxRuleId);
        const leafModules = this.lookupMaps.leafPathToModules[pathKey] || [];
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
     * Get validation state cache statistics for debugging
     */
    getValidationStats(): {
        cachedModuleAUs: number;
        selectedModules: number;
        violatingModules: number;
        maxRulesFulfilled: number;
    } {
        return {
            cachedModuleAUs: this.moduleAUCache.size,
            selectedModules: this.validationState.selectedModules.size,
            violatingModules: this.validationState.violatingModules.size,
            maxRulesFulfilled: this.validationState.maxRuleFulfillment.size
        };
    }
}