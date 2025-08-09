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

    async updateProgress(module: ModuleCode, action: 'ADD' | 'REMOVE'): Promise<void> {
        try {
            const moduleAU = await dbService.getModuleAU(module);
            const doubleCountModules = this.validator.getDoubleCountModules();
            const allocatedProgrammes = doubleCountModules.get(module) || [];

            // console.log(`${action} ${module} (${moduleAU} AU) - allocated to:`, allocatedProgrammes);

            if (action === 'ADD') {
                await this.addModuleToProgress(module, moduleAU, allocatedProgrammes);
            } else {
                await this.removeModuleFromProgress(module, moduleAU, allocatedProgrammes);
            }

            // Recalculate all levels of progress
            await this.calculateProgrammeProgress();
            await this.calculateUEProgress();
            
            // console.log('Progress update completed for', module);
        } catch (error) {
            console.error(`Error updating progress for ${module}:`, error);
        }
    }

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
                // Get ALL paths in hierarchy (leaf + all ancestors up to section)
                const allPathsInHierarchy = await this.getAllPathsInHierarchy(
                    leafPath.pathId, 
                    leafPath.programmeId
                );
                
                // Add to all paths in hierarchy
                for (const pathId of allPathsInHierarchy) {
                    // Fallback (section might be stored as pathKey)
                    let resolvedPathId = pathId;
                    if (resolvedPathId.includes('_')) {
                        const pathProgrammeId = leafPath.programmeId;
                        const dbResolvedId = await dbService.getPathIdByKey(pathProgrammeId, resolvedPathId);
                        if (dbResolvedId) {
                            resolvedPathId = dbResolvedId;
                        }
                    }
                    this.addToPath(resolvedPathId, moduleAU, module);
                }
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
                // Get ALL paths in hierarchy
                const allPathsInHierarchy = await this.getAllPathsInHierarchy(
                    leafPath.pathId, 
                    leafPath.programmeId
                );
                
                // Remove from all paths in hierarchy
                for (const pathId of allPathsInHierarchy) {
                    // Fallback (section might be stored as pathKey)
                    let resolvedPathId = pathId;
                    if (resolvedPathId.includes('_')) {
                        const pathProgrammeId = leafPath.programmeId;
                        const dbResolvedId = await dbService.getPathIdByKey(pathProgrammeId, resolvedPathId);
                        if (dbResolvedId) {
                            resolvedPathId = dbResolvedId;
                        }
                    }
                    this.removeFromPath(resolvedPathId, moduleAU, module);
                }
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

    private async getAllPathsInHierarchy(
        startPathId: string, 
        programmeId: string
    ): Promise<string[]> {
        const allPaths: string[] = [startPathId];
        const visited = new Set<string>([startPathId]);

        // Get all ancestors recursively
        const ancestors = await this.findAllAncestors(startPathId, programmeId, visited);
        allPaths.push(...ancestors);
        return allPaths;
    }

    private async findAllAncestors(
        pathId: string, 
        programmeId: string,
        visited: Set<string>
    ): Promise<string[]> {
        const ancestors: string[] = [];
        const hierarchy = this.lookupMaps.pathHierarchy?.[programmeId];
        
        if (hierarchy) {
            for (const [parentId, childrenIds] of Object.entries(hierarchy)) {
                if (childrenIds.includes(pathId) && !visited.has(parentId)) {
                    visited.add(parentId);
                    ancestors.push(parentId);
                    const parentAncestors = await this.findAllAncestors(parentId, programmeId, visited);
                    ancestors.push(...parentAncestors);
                }
            }
        } else {
            // Fallback to database query
            const parentIds = await dbService.getParentPathIds(pathId, programmeId);
            for (const parentId of parentIds) {
                if (!visited.has(parentId)) {
                    visited.add(parentId);
                    ancestors.push(parentId);
                    const parentAncestors = await this.findAllAncestors(parentId, programmeId, visited);
                    ancestors.push(...parentAncestors);
                }
            }
        }
        
        return ancestors;
    }

    private async calculateProgrammeProgress(): Promise<void> {
        for (const programme of this.programmes) {
            const isMajor = programme.metadata.type === 'major';
            let totalFulfilled = 0;
            let coreAU = 0;

            if (isMajor) {
                // Major shows sum of ALL section paths from ALL programmes
                for (const anyProgramme of this.programmes) {
                    const sectionPathIds = await this.getSectionPathIds(anyProgramme.programmeId);
                    for (const sectionId of sectionPathIds) {
                        const sectionAU = this.progressState.pathFulfillment.get(sectionId) || 0;
                        totalFulfilled += sectionAU;
                        if (anyProgramme.programmeId === programme.programmeId) {
                            coreAU += sectionAU;
                        }
                    }
                }
            } else {
                // Other programmes show only their own section paths
                const sectionPathIds = await this.getSectionPathIds(programme.programmeId);
                for (const sectionId of sectionPathIds) {
                    const sectionAU = this.progressState.pathFulfillment.get(sectionId) || 0;
                    totalFulfilled += sectionAU;
                    coreAU += sectionAU;
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
            
            // console.log(`Programme ${programme.programmeId} progress: ${totalFulfilled}/${totalRequired} AU`);
        }
    }

    // Helper to get section path IDs (depth 1, no parent)
    private async getSectionPathIds(programmeId: string): Promise<string[]> {
        const programme = this.programmes.find(p => p.programmeId === programmeId);
        if (!programme) return [];
        
        const sectionIds: string[] = [];
        
        for (const section of programme.sections) {
            if (section.groupType !== 'unrestrictedElectives') {
                const sectionPath = section.paths?.find(p => p.depth === 1 && !p.parentPathKey);
                if (sectionPath) {
                    sectionIds.push(sectionPath.pathId);
                } else {
                    // Fallback to database query
                    const programmeKey = this.toSnakeCase(programme.metadata.name);
                    const programmeType = programme.metadata.type;
                    const sectionKey = `${programmeKey}-${programmeType}-${this.toSnakeCase(section.groupType)}`;
                    const sectionId = await dbService.getPathIdByKey(programmeId, sectionKey);
                    if (sectionId) sectionIds.push(sectionId);
                }
            }
        }
        
        return sectionIds;
    }

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

        // Sum section paths for major programme
        const majorSectionIds = await this.getSectionPathIds(majorProgramme.programmeId);
        for (const sectionId of majorSectionIds) {
            majorCoreAU += this.progressState.pathFulfillment.get(sectionId) || 0;
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
        
        // console.log(`UE calculation: ${ueFulfilled}/${ueRequired} AU (${autoIncludedModules.length} auto-included modules)`);
    }

    private async findAutoIncludedModules(majorProgramme: ProgrammePayload): Promise<ModuleCode[]> {
        const autoIncluded: ModuleCode[] = [];
        const selectedModules = this.validator.getSelectedModules();
        const doubleCountModules = this.validator.getDoubleCountModules();

        for (const module of selectedModules) {
            const leafPaths = this.lookupMaps.moduleToLeafPaths[module] || [];
            const allocatedProgrammes = doubleCountModules.get(module) || [];
            // console.log(`Checking auto-include for ${module} in major ${majorProgramme.programmeId} - allocated to:`, allocatedProgrammes);
            
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

    async buildRequirementTree(programmeId: string): Promise<RequirementNode[]> {
        const programme = this.programmes.find(p => p.programmeId === programmeId);
        if (!programme) return [];

        const nodes: RequirementNode[] = [];

        // Build nodes for each section
        for (const section of programme.sections) {
            if (section.groupType !== 'unrestrictedElectives') {
                const sectionNode = await this.buildSectionNode(section, programmeId);
                if (sectionNode) {
                    nodes.push(sectionNode);
                }
            }
        }

        // Add UE section for major programmes
        if (programme.metadata.type === 'major' && this.progressState.ueCalculation.required > 0) {
            const ueNode: RequirementNode = {
                pathId: `${programmeId}-unrestrictedElectives`,
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

    private async buildSectionNode(
        section: any, 
        programmeId: string
    ): Promise<RequirementNode | null> {
        // Find section pathId
        let sectionId: string | null = null;
        
        // Check if section has a path with depth 1 and no parent
        const sectionPath = section.paths?.find((p: any) => p.depth === 1 && !p.parentPathKey);
        if (sectionPath) {
            sectionId = sectionPath.pathId;
        } else {
            // Fallback to database query
            const programme = this.programmes.find(p => p.programmeId === programmeId);
            if (programme) {
                const programmeKey = this.toSnakeCase(programme.metadata.name);
                const programmeType = programme.metadata.type;
                const sectionKey = `${programmeKey}-${programmeType}-${this.toSnakeCase(section.groupType)}`;
                sectionId = await dbService.getPathIdByKey(programmeId, sectionKey);
            }
        }

        if (!sectionId) {
            console.warn(`Could not find pathId for section ${section.groupType}`);
            return null;
        }

        const fulfilledAU = this.progressState.pathFulfillment.get(sectionId) || 0;
        const modules = this.progressState.pathModules.get(sectionId) || [];

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
            for (const path of section.paths.slice(0, 5)) {
                const pathFulfilled = this.progressState.pathFulfillment.get(path.pathId) || 0;
                const pathModules = this.progressState.pathModules.get(path.pathId) || [];

                children.push({
                    pathId: path.pathId,
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
            pathId: sectionId,
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
            
            const sectionPath = section.paths?.find((p: any) => p.depth === 1 && !p.parentPathKey);
            let sectionId = sectionPath?.pathId;
            
            if (!sectionId) {
                const programmeKey = this.toSnakeCase(programme.metadata.name);
                const programmeType = programme.metadata.type;
                const sectionKey = `${programmeKey}-${programmeType}-${this.toSnakeCase(section.groupType)}`;
                sectionId = (await dbService.getPathIdByKey(programme.programmeId, sectionKey)) ?? undefined;
            }
            
            const sectionAU = sectionId ? this.progressState.pathFulfillment.get(sectionId) || 0 : 0;
            const sectionModules = sectionId ? this.progressState.pathModules.get(sectionId) || [] : [];

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

    // snake_case helper
    toSnakeCase(input: string): string {
        return input
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[\s\-]+/g, '_')
            .toLowerCase();
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