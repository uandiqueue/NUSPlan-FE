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
        
    }

    /**
     * Update progress when a module is selected/removed
     */
    async updateProgress(module: ModuleCode, action: 'ADD' | 'REMOVE'): Promise<void> {
        try {
            const moduleAU = await dbService.getModuleAU(module);
            const doubleCountModules = this.validator.getDoubleCountModules();
            const allocatedProgrammes = doubleCountModules.get(module) || [];

            console.log(`${action} ${module} (${moduleAU} AU) - allocated to:`, allocatedProgrammes);

            if (action === 'ADD') {
                await this.addModuleToProgress(module, moduleAU, allocatedProgrammes);
            } else {
                await this.removeModuleFromProgress(module, moduleAU, allocatedProgrammes);
            }

            // Recalculate all levels of progress
            await this.calculateProgrammeProgress();
            await this.calculateUEProgress();
            
            console.log('Progress update completed for', module);
        } catch (error) {
            console.error(`Error updating progress for ${module}:`, error);
        }
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
                this.addToPath(leafPath.pathId, moduleAU, module);

                // Add to all parent paths
                await this.addToParentPaths(leafPath.pathId, leafPath.programmeId, moduleAU, module);
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
                this.removeFromPath(leafPath.pathId, moduleAU, module);

                // Remove from all parent paths
                await this.removeFromParentPaths(leafPath.pathId, leafPath.programmeId, moduleAU, module);
            }
        }
    }

    private addToPath(pathId: string, moduleAU: number, module: ModuleCode): void {
        // Update fulfilled AU
        const currentAU = this.progressState.pathFulfillment.get(pathId) || 0;
        this.progressState.pathFulfillment.set(pathId, currentAU + moduleAU);

        // Add module to path
        const currentModules = this.progressState.pathModules.get(pathId) || [];
        if (!currentModules.includes(module)) {
            currentModules.push(module);
            this.progressState.pathModules.set(pathId, currentModules);
        }
    }

    private removeFromPath(pathId: string, moduleAU: number, module: ModuleCode): void {
        // Update fulfilled AU
        const currentAU = this.progressState.pathFulfillment.get(pathId) || 0;
        this.progressState.pathFulfillment.set(pathId, Math.max(0, currentAU - moduleAU));

        // Remove module from path
        const currentModules = this.progressState.pathModules.get(pathId) || [];
        const updatedModules = currentModules.filter(m => m !== module);
        this.progressState.pathModules.set(pathId, updatedModules);
    }

    private async addToParentPaths(leafPathId: string, programmeId: string, moduleAU: number, module: ModuleCode): Promise<void> {
        const parentPaths = this.findParentPaths(leafPathId, programmeId);
        for (const parentPathId of parentPaths) {
            this.addToPath(parentPathId, moduleAU, module);
        }
    }

    private async removeFromParentPaths(leafPathId: string, programmeId: string, moduleAU: number, module: ModuleCode): Promise<void> {
        const parentPaths = this.findParentPaths(leafPathId, programmeId);
        for (const parentPathId of parentPaths) {
            this.removeFromPath(parentPathId, moduleAU, module);
        }
    }

    private findParentPaths(pathId: string, programmeId: string): string[] {
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
        
        // Also add the programme-level and section-level paths
        const programme = this.programmes.find(p => p.programmeId === programmeId);
        if (programme) {
            // Add programme-level path
            parents.push(programmeId);
            
            // Add section-level path
            const leafPath = this.lookupMaps.moduleToLeafPaths[pathId];
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
            
            console.log(`Programme ${programme.programmeId} progress: ${totalFulfilled}/${totalRequired} AU`);
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
                const sectionAU = this.progressState.pathFulfillment.get(sectionKey) || 0;
                majorCoreAU += sectionAU;
            }
        }

        // Calculate UE required
        const totalRequired = majorProgramme.metadata.requiredUnits;
        const ueRequired = Math.max(0, totalRequired - majorCoreAU);

        // Find auto-included modules (modules used in other programmes but not major)
        const autoIncludedModules = await this.findAutoIncludedModules(majorProgramme);
        
        // Calculate auto-included AU using database values
        let autoIncludedAU = 0;
        for (const module of autoIncludedModules) {
            autoIncludedAU += await dbService.getModuleAU(module);
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
        
        console.log(`UE calculation: ${ueFulfilled}/${ueRequired} AU (${autoIncludedModules.length} auto-included modules)`);
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
        const fulfilledAU = this.progressState.pathFulfillment.get(sectionKey) || 0;
        const modules = this.progressState.pathModules.get(sectionKey) || [];

        // Calculate required AU from section paths
        let requiredAU = 0;
        if (section.paths && Array.isArray(section.paths)) {
            for (const path of section.paths) {
                if (path.requiredUnits && path.requiredUnits > 0) {
                    requiredAU += path.requiredUnits;
                }
            }
        }

        // Skip empty sections
        if (requiredAU === 0 && modules.length === 0) {
            return null;
        }

        // Build children
        const children: RequirementNode[] = [];
        if (section.paths && Array.isArray(section.paths)) {
            for (const path of section.paths.slice(0, 5)) { // Limit for performance
                const pathKey = `${programmeId}:${path.pathKey}`;
                const pathFulfilled = this.progressState.pathFulfillment.get(pathKey) || 0;
                const pathModules = this.progressState.pathModules.get(pathKey) || [];
                
                children.push({
                    pathKey,
                    displayLabel: path.displayLabel || path.pathKey,
                    requiredAU: path.requiredUnits || 0,
                    fulfilledAU: pathFulfilled,
                    children: [],
                    isLeaf: true, // Simplified - treat as leaf
                    groupType: path.groupType || section.groupType,
                    depth: (path.depth || 0) + 1,
                    progressPercentage: path.requiredUnits > 0 ? 
                        (pathFulfilled / path.requiredUnits) * 100 : 0,
                    status: this.determineNodeStatus(pathFulfilled, path.requiredUnits || 0),
                    modules: pathModules
                });
            }
        }

        return {
            pathKey: sectionKey,
            displayLabel: section.displayLabel || section.groupType,
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

    private determineNodeStatus(
        fulfilled: number, 
        required: number
    ): 'not_started' | 'in_progress' | 'completed' | 'exceeded' {
        if (fulfilled === 0) return 'not_started';
        if (fulfilled >= required) return fulfilled > required ? 'exceeded' : 'completed';
        return 'in_progress';
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
            required: programmeProgress?.totalRequired || programme.metadata.requiredUnits,
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
            if (section.paths && Array.isArray(section.paths)) {
                for (const path of section.paths) {
                    requiredAU += path.requiredUnits || 0;
                }
            }

            // Get detailed module information
            const moduleDetails = sectionModules.length > 0 ? 
                await dbService.getModulesDetails(sectionModules) : [];
            const modules = moduleDetails.map(module => ({
                moduleCode: module.module_code as ModuleCode,
                title: module.title,
                au: Number(module.module_credit)
            }));

            sectionBreakdown.push({
                groupType: section.groupType,
                displayLabel: section.displayLabel || section.groupType,
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
     * Get fulfilment tracker statistics for debugging
     */
    getTrackerStats(): {
        trackedPaths: number;
        trackedModules: number;
        totalProgrammes: number;
    } {
        return {
            trackedPaths: this.progressState.pathFulfillment.size,
            trackedModules: this.progressState.pathModules.size,
            totalProgrammes: this.programmes.length
        };
    }
}