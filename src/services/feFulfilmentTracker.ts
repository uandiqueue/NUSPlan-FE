import type { ModuleCode } from '../types/nusmods-types';
import type { LookupMaps, ProgrammePayload, PathInfo } from '../types/shared-types';
import type { RealtimeValidator } from './feRealtimeValidator';
import type { RequirementNode, ProgressState } from '../types/frontend-types';
import { dbService } from './dbQuery';

export class FulfilmentTracker {
    private progressState: ProgressState;
    private validator: RealtimeValidator;
    private lookupMaps: LookupMaps;
    private programmes: ProgrammePayload[];
    
    // Cache for module AU values to improve performance during progress updates
    private moduleAUCache = new Map<ModuleCode, number>();

    constructor(
        progressState: ProgressState,
        validator: RealtimeValidator, 
        lookupMaps: LookupMaps, 
        programmes: ProgrammePayload[]
    ) {
        this.progressState = progressState;
        this.validator = validator;
        this.lookupMaps = lookupMaps;
        this.programmes = programmes;
        
        // Initialize the tracker by preloading module data
        this.preloadModuleAUs();
    }

    /**
     * Preload module AU data for all modules in the academic plan
     * This improves performance during frequent progress updates
     */
    private async preloadModuleAUs(): Promise<void> {
        try {
            // Collect all unique modules from lookup maps
            const allModules = new Set<ModuleCode>();
            
            Object.keys(this.lookupMaps.moduleToLeafPaths).forEach(moduleCode => {
                allModules.add(moduleCode as ModuleCode);
            });
            
            Object.values(this.lookupMaps.leafPathToModules).forEach(modules => {
                modules.forEach(moduleCode => allModules.add(moduleCode));
            });

            console.log(`Preloading AU data for ${allModules.size} modules in progress tracker...`);
            
            // Use the database service's preload method
            await dbService.preloadModules(Array.from(allModules));
            
            console.log('Module AU preloading completed for progress tracker');
        } catch (error) {
            console.error('Error preloading module AU data:', error);
            // Progress tracking will still work with individual database requests
        }
    }

    /**
     * Update progress when a module is selected/removed
     */
    async updateProgress(module: ModuleCode, action: 'ADD' | 'REMOVE'): Promise<void> {
        const moduleAU = await this.getModuleAU(module);
        const doubleCountModules = this.validator.getDoubleCountModules();
        const allocatedProgrammes = doubleCountModules.get(module) || [];

        if (action === 'ADD') {
            await this.addModuleToProgress(module, moduleAU, allocatedProgrammes);
        } else {
            await this.removeModuleFromProgress(module, moduleAU, allocatedProgrammes);
        }

        // Recalculate programme-level progress
        await this.calculateProgrammeProgress();
        
        // Recalculate UE for major programme
        await this.calculateUEProgress();
    }

    /**
     * Add module to progress tracking
     */
    private async addModuleToProgress(
        module: ModuleCode, 
        moduleAU: number, 
        allocatedProgrammes: string[]
    ): Promise<void> {
        const leafPaths = this.lookupMaps.moduleToLeafPaths[module] || [];
        
        for (const leafPath of leafPaths) {
            // Only count if this programme is in allocated programmes (for double counting)
            // or if no allocation specified (single count)
            if (allocatedProgrammes.length === 0 || allocatedProgrammes.includes(leafPath.programmeId)) {
                // Add to leaf path
                this.addToPath(leafPath.pathKey, moduleAU, module);
                
                // Add to all parent paths
                await this.addToParentPaths(leafPath.pathKey, leafPath.programmeId, moduleAU, module);
            }
        }
    }

    private async removeModuleFromProgress(
        module: ModuleCode, 
        moduleAU: number, 
        allocatedProgrammes: string[]
    ): Promise<void> {
        const leafPaths = this.lookupMaps.moduleToLeafPaths[module] || [];
        
        for (const leafPath of leafPaths) {
            if (allocatedProgrammes.length === 0 || allocatedProgrammes.includes(leafPath.programmeId)) {
                // Remove from leaf path
                this.removeFromPath(leafPath.pathKey, moduleAU, module);
                
                // Remove from all parent paths
                await this.removeFromParentPaths(leafPath.pathKey, leafPath.programmeId, moduleAU, module);
            }
        }
    }

    private addToPath(pathKey: string, moduleAU: number, module: ModuleCode): void {
        // Update fulfilled AU
        const currentAU = this.progressState.pathFulfillment.get(pathKey) || 0;
        this.progressState.pathFulfillment.set(pathKey, currentAU + moduleAU);
        
        // Add module to path
        const currentModules = this.progressState.pathModules.get(pathKey) || [];
        if (!currentModules.includes(module)) {
            currentModules.push(module);
            this.progressState.pathModules.set(pathKey, currentModules);
        }
    }

    private removeFromPath(pathKey: string, moduleAU: number, module: ModuleCode): void {
        // Update fulfilled AU
        const currentAU = this.progressState.pathFulfillment.get(pathKey) || 0;
        this.progressState.pathFulfillment.set(pathKey, Math.max(0, currentAU - moduleAU));
        
        // Remove module from path
        const currentModules = this.progressState.pathModules.get(pathKey) || [];
        const updatedModules = currentModules.filter(m => m !== module);
        this.progressState.pathModules.set(pathKey, updatedModules);
    }

    private async addToParentPaths(leafPathKey: string, programmeId: string, moduleAU: number, module: ModuleCode): Promise<void> {
        const parentPaths = this.findParentPaths(leafPathKey, programmeId);
        for (const parentPathKey of parentPaths) {
            this.addToPath(parentPathKey, moduleAU, module);
        }
    }

    private async removeFromParentPaths(leafPathKey: string, programmeId: string, moduleAU: number, module: ModuleCode): Promise<void> {
        const parentPaths = this.findParentPaths(leafPathKey, programmeId);
        for (const parentPathKey of parentPaths) {
            this.removeFromPath(parentPathKey, moduleAU, module);
        }
    }

    private findParentPaths(pathKey: string, programmeId: string): string[] {
        const parents: string[] = [];
        const hierarchy = this.lookupMaps.pathHierarchy[programmeId];
        if (!hierarchy) return parents;
        
        // Find all ancestors of this path
        const findAncestors = (currentKey: string) => {
            for (const [parentKey, children] of Object.entries(hierarchy)) {
                if (children.includes(currentKey)) {
                    const fullParentKey = `${programmeId}:${parentKey}`;
                    parents.push(fullParentKey);
                    findAncestors(parentKey); // Recursive call
                }
            }
        };
        
        // Extract the path part from the full pathKey (format: programmeId:pathKey)
        const pathPart = pathKey.split(':')[1];
        if (pathPart) {
            findAncestors(pathPart);
        }
        
        // Also add the programme-level and section-level paths
        const programme = this.programmes.find(p => p.programmeId === programmeId);
        if (programme) {
            // Add programme-level path
            parents.push(programmeId);
            
            // Add section-level path
            const leafPath = this.lookupMaps.moduleToLeafPaths[pathKey];
            if (leafPath && leafPath.length > 0) {
                const sectionKey = `${programmeId}-${leafPath[0].groupType}`;
                if (!parents.includes(sectionKey)) {
                    parents.push(sectionKey);
                }
            }
        }
        
        return parents;
    }

    /**
     * Calculate programme-level progress with accurate module AU values
     */
    private async calculateProgrammeProgress(): Promise<void> {
        for (const programme of this.programmes) {
            const isMajor = programme.metadata.type === 'major';
            let totalFulfilled = 0;
            let coreAU = 0;

            if (isMajor) {
                // Major shows sum of ALL selected units from ALL programmes
                for (const anyProgramme of this.programmes) {
                    for (const section of anyProgramme.sections) {
                        if (section.groupType !== 'unrestrictedElectives') {
                            const sectionKey = `${anyProgramme.programmeId}-${section.groupType}`;
                            const sectionAU = this.progressState.pathFulfillment.get(sectionKey) || 0;
                            totalFulfilled += sectionAU;
                            if (anyProgramme.programmeId === programme.programmeId) {
                                coreAU += sectionAU;
                            }
                        }
                    }
                }
            } else {
                // Other programmes show only their own units
                for (const section of programme.sections) {
                    if (section.groupType !== 'unrestrictedElectives') {
                        const sectionKey = `${programme.programmeId}-${section.groupType}`;
                        const sectionAU = this.progressState.pathFulfillment.get(sectionKey) || 0;
                        totalFulfilled += sectionAU;
                        coreAU += sectionAU;
                    }
                }
            }

            // Calculate UE for major programme
            const ueAU = isMajor ? this.progressState.ueCalculation.fulfilled : 0;
            totalFulfilled += ueAU;

            // Adjust required units if exceeded
            const baseRequired = programme.metadata.requiredUnits;
            const totalRequired = Math.max(baseRequired, totalFulfilled);

            this.progressState.programmeProgress.set(programme.programmeId, {
                totalRequired,
                totalFulfilled,
                coreAU,
                ueAU
            });
        }
    }

    /**
     * Dynamically calculate UEs with accurate module AU values
     */
    private async calculateUEProgress(): Promise<void> {
        const majorProgramme = this.programmes.find(p => p.metadata.type === 'major');
        if (!majorProgramme) {
            this.progressState.ueCalculation = {
                required: 0,
                fulfilled: 0,
                autoIncludedModules: [],
                overflow: 0
            };
            return;
        }

        // Calculate core fulfilled AU for major programme only
        let majorCoreAU = 0;
        for (const section of majorProgramme.sections) {
            if (section.groupType !== 'unrestrictedElectives') {
                const sectionKey = `${majorProgramme.programmeId}-${section.groupType}`;
                majorCoreAU += this.progressState.pathFulfillment.get(sectionKey) || 0;
            }
        }

        // Calculate UE required
        const totalRequired = majorProgramme.metadata.requiredUnits;
        const ueRequired = Math.max(0, totalRequired - majorCoreAU);

        // Find auto-included modules
        const autoIncludedModules = await this.findAutoIncludedModules(majorProgramme);
        
        // Calculate auto-included AU using database values
        let autoIncludedAU = 0;
        for (const module of autoIncludedModules) {
            autoIncludedAU += await this.getModuleAU(module);
        }

        // Calculate fulfilled and overflow
        const ueFulfilled = Math.min(autoIncludedAU, ueRequired);
        const overflow = Math.max(0, autoIncludedAU - ueRequired);

        this.progressState.ueCalculation = {
            required: ueRequired,
            fulfilled: ueFulfilled,
            autoIncludedModules,
            overflow
        };
    }

    /**
     * Find modules that should be auto-included in UE
     */
    private async findAutoIncludedModules(majorProgramme: ProgrammePayload): Promise<ModuleCode[]> {
        const autoIncluded: ModuleCode[] = [];
        const selectedModules = this.validator.getSelectedModules();
        const doubleCountModules = this.validator.getDoubleCountModules();

        for (const module of selectedModules) {
            const leafPaths = this.lookupMaps.moduleToLeafPaths[module] || [];
            const allocatedProgrammes = doubleCountModules.get(module) || [];
            
            // Check if module is used in major programme
            const isUsedInMajor = leafPaths.some(path => 
                path.programmeId === majorProgramme.programmeId &&
                (allocatedProgrammes.length === 0 || allocatedProgrammes.includes(majorProgramme.programmeId))
            );
            
            // Check if module is used in other programmes
            const isUsedInOtherProgrammes = leafPaths.some(path => 
                path.programmeId !== majorProgramme.programmeId &&
                (allocatedProgrammes.length === 0 || allocatedProgrammes.includes(path.programmeId))
            );
            
            if (isUsedInOtherProgrammes && !isUsedInMajor) {
                autoIncluded.push(module);
            }
        }

        return autoIncluded;
    }

    /**
     * Build requirement tree for UI rendering with accurate progress calculation
     */
    async buildRequirementTree(programmeId: string): Promise<RequirementNode[]> {
        const programme = this.programmes.find(p => p.programmeId === programmeId);
        if (!programme) return [];

        const nodes: RequirementNode[] = [];

        // Build nodes for each section
        for (const section of programme.sections) {
            const sectionKey = `${programmeId}-${section.groupType}`;
            const sectionNode = await this.buildSectionNode(section, sectionKey, programmeId);
            
            if (sectionNode) {
                nodes.push(sectionNode);
            }
        }

        // Add UE section for major programmes
        if (programme.metadata.type === 'major' && this.progressState.ueCalculation.required > 0) {
            const ueNode: RequirementNode = {
                pathKey: `${programmeId}-unrestrictedElectives`,
                displayLabel: 'Unrestricted Electives',
                requiredAU: this.progressState.ueCalculation.required,
                fulfilledAU: this.progressState.ueCalculation.fulfilled,
                children: [],
                isLeaf: true,
                groupType: 'unrestrictedElectives',
                depth: 0,
                progressPercentage: this.progressState.ueCalculation.required > 0 
                    ? (this.progressState.ueCalculation.fulfilled / this.progressState.ueCalculation.required) * 100 
                    : 0,
                status: this.determineNodeStatus(
                    this.progressState.ueCalculation.fulfilled, 
                    this.progressState.ueCalculation.required
                ),
                modules: this.progressState.ueCalculation.autoIncludedModules
            };
            nodes.push(ueNode);
        }

        return nodes;
    }

    private async buildSectionNode(section: any, sectionKey: string, programmeId: string): Promise<RequirementNode | null> {
        // Calculate section totals from its paths
        let requiredAU = 0;
        const fulfilledAU = this.progressState.pathFulfillment.get(sectionKey) || 0;
        const modules = this.progressState.pathModules.get(sectionKey) || [];

        // Build children from paths
        const children = await this.buildPathNodes(section.paths, programmeId, 1);
        
        // Calculate required AU from children
        for (const child of children) {
            if (child.requiredAU > 0) {
                requiredAU += child.requiredAU;
            }
        }

        if (requiredAU === 0 && children.length === 0) {
            return null; // Skip empty sections
        }

        return {
            pathKey: sectionKey,
            displayLabel: section.displayLabel,
            requiredAU,
            fulfilledAU,
            children,
            isLeaf: false,
            groupType: section.groupType,
            depth: 0,
            progressPercentage: requiredAU > 0 ? (fulfilledAU / requiredAU) * 100 : 0,
            status: this.determineNodeStatus(fulfilledAU, requiredAU),
            modules
        };
    }

    private async buildPathNodes(paths: PathInfo[], programmeId: string, depth: number): Promise<RequirementNode[]> {
        const nodes: RequirementNode[] = [];
        const hierarchy = this.lookupMaps.pathHierarchy[programmeId] || {};
        
        // Group paths by parent
        const rootPaths = paths.filter(path => !path.parentPathKey || path.depth === depth);
        
        for (const path of rootPaths) {
            const pathKey = `${programmeId}:${path.pathKey}`;
            const fulfilledAU = this.progressState.pathFulfillment.get(pathKey) || 0;
            const modules = this.progressState.pathModules.get(pathKey) || [];
            
            // Find child paths
            const childPaths = paths.filter(p => p.parentPathKey === path.pathKey);
            const children = childPaths.length > 0 
                ? await this.buildPathNodes(childPaths, programmeId, depth + 1)
                : [];
            
            const node: RequirementNode = {
                pathKey,
                displayLabel: path.displayLabel,
                requiredAU: path.requiredUnits,
                fulfilledAU,
                children,
                isLeaf: path.logicType === 'LEAF',
                groupType: path.groupType,
                depth: path.depth,
                progressPercentage: path.requiredUnits > 0 
                    ? (fulfilledAU / path.requiredUnits) * 100 
                    : 0,
                status: this.determineNodeStatus(fulfilledAU, path.requiredUnits),
                modules
            };
            
            nodes.push(node);
        }
        
        return nodes;
    }

    private determineNodeStatus(
        fulfilled: number, 
        required: number
    ): 'not_started' | 'in_progress' | 'completed' | 'exceeded' {
        if (fulfilled === 0) return 'not_started';
        if (fulfilled >= required) return fulfilled > required ? 'exceeded' : 'completed';
        return 'in_progress';
    }

    /**
     * Get module AU with caching and database integration
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

    /**
     * Get detailed progress summary with module information
     */
    async getDetailedProgressSummary(programmeId: string): Promise<{
        totalProgress: { required: number; fulfilled: number; percentage: number };
        sectionBreakdown: Array<{
            groupType: string;
            displayLabel: string;
            required: number;
            fulfilled: number;
            percentage: number;
            modules: Array<{
                moduleCode: ModuleCode;
                title: string;
                au: number;
            }>;
        }>;
    }> {
        const programme = this.programmes.find(p => p.programmeId === programmeId);
        if (!programme) {
            return {
                totalProgress: { required: 0, fulfilled: 0, percentage: 0 },
                sectionBreakdown: []
            };
        }

        const programmeProgress = this.progressState.programmeProgress.get(programmeId);
        const totalProgress = {
            required: programmeProgress?.totalRequired || 0,
            fulfilled: programmeProgress?.totalFulfilled || 0,
            percentage: programmeProgress ? 
                (programmeProgress.totalFulfilled / programmeProgress.totalRequired) * 100 : 0
        };

        const sectionBreakdown = [];

        for (const section of programme.sections) {
            if (section.groupType === 'unrestrictedElectives') continue;

            const sectionKey = `${programmeId}-${section.groupType}`;
            const sectionAU = this.progressState.pathFulfillment.get(sectionKey) || 0;
            const sectionModules = this.progressState.pathModules.get(sectionKey) || [];

            // Calculate required AU for this section
            let requiredAU = 0;
            for (const path of section.paths) {
                requiredAU += path.requiredUnits;
            }

            // Get detailed module information
            const moduleDetails = await dbService.getModulesDetails(sectionModules);
            const modules = moduleDetails.map(module => ({
                moduleCode: module.moduleCode,
                title: module.title,
                au: module.moduleUnit
            }));

            sectionBreakdown.push({
                groupType: section.groupType,
                displayLabel: section.displayLabel,
                required: requiredAU,
                fulfilled: sectionAU,
                percentage: requiredAU > 0 ? (sectionAU / requiredAU) * 100 : 0,
                modules
            });
        }

        return { totalProgress, sectionBreakdown };
    }

    // Getters for UI components
    getProgressState(): ProgressState {
        return this.progressState;
    }

    getProgrammeProgress(programmeId: string) {
        return this.progressState.programmeProgress.get(programmeId);
    }

    getUECalculation() {
        return this.progressState.ueCalculation;
    }

    /**
     * Clear fulfilment tracker caches
     */
    clearCaches(): void {
        this.moduleAUCache.clear();
    }

    /**
     * Get fulfilment tracker statistics for debugging
     */
    getTrackerStats(): {
        cachedModuleAUs: number;
        trackedPaths: number;
        trackedModules: number;
        totalProgrammes: number;
    } {
        return {
            cachedModuleAUs: this.moduleAUCache.size,
            trackedPaths: this.progressState.pathFulfillment.size,
            trackedModules: this.progressState.pathModules.size,
            totalProgrammes: this.programmes.length
        };
    }
}