import { supabase } from '../config/supabase';
import type { ModuleCode } from '../types/nusmods-types';
import type { 
    FEModuleData, 
    FEPreclusionData, 
    FEPrerequisiteData,
    CachedModuleInfo
} from '../types/frontend-types';

export class FrontendDatabaseService {
    private static instance: FrontendDatabaseService;
    
    // Cache configurations
    private readonly MODULE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    private readonly RULES_CACHE_TTL = 60 * 60 * 1000; // 1 hour
    
    // Cache storage
    private moduleCache = new Map<ModuleCode, CachedModuleInfo>();
    private prerequisiteCache = new Map<ModuleCode, { data: ModuleCode[], timestamp: number }>();
    private preclusionCache = new Map<ModuleCode, { data: ModuleCode[], timestamp: number }>();
    
    // Batch request deduplication
    private pendingModuleRequests = new Map<string, Promise<FEModuleData[]>>();
    private pendingPrereqRequests = new Map<string, Promise<FEPrerequisiteData[]>>();
    private pendingPreclusionRequests = new Map<string, Promise<FEPreclusionData[]>>();

    private constructor() {}

    public static getInstance(): FrontendDatabaseService {
        if (!FrontendDatabaseService.instance) {
            FrontendDatabaseService.instance = new FrontendDatabaseService();
        }
        return FrontendDatabaseService.instance;
    }

    /**
     * Get module credits (AU) for a single module
     * This is the most commonly called method, so it's heavily optimized with caching
     */
    async getModuleAU(moduleCode: ModuleCode): Promise<number> {
        const cached = this.moduleCache.get(moduleCode);
        
        if (cached && (Date.now() - cached.timestamp) < this.MODULE_CACHE_TTL) {
            return cached.moduleUnit;
        }

        // Fetch fresh data if not cached or expired
        const modules = await this.getModulesDetails([moduleCode]);
        if (modules.length === 0) {
            console.warn(`Module ${moduleCode} not found, defaulting to 4 AU`);
            return 4; // Safe fallback
        }

        return modules[0].moduleUnit;
    }

    /**
     * Get detailed module information with intelligent batching and caching
     */
    async getModulesDetails(moduleCodes: ModuleCode[]): Promise<FEModuleData[]> {
        if (moduleCodes.length === 0) return [];

        // Check cache first and separate cached vs uncached modules
        const cachedResults: FEModuleData[] = [];
        const uncachedCodes: ModuleCode[] = [];
        const now = Date.now();

        for (const code of moduleCodes) {
            const cached = this.moduleCache.get(code);
            if (cached && (now - cached.timestamp) < this.MODULE_CACHE_TTL) {
                cachedResults.push({
                    moduleCode: cached.moduleCode,
                    title: cached.title,
                    moduleUnit: cached.moduleUnit,
                    description: cached.description,
                    department: cached.department,
                    faculty: cached.faculty
                });
            } else {
                uncachedCodes.push(code);
            }
        }

        // If all modules are cached, return immediately
        if (uncachedCodes.length === 0) {
            return cachedResults;
        }

        // Batch fetch uncached modules to prevent duplicate requests
        const batchKey = uncachedCodes.sort().join(',');
        
        if (!this.pendingModuleRequests.has(batchKey)) {
            const fetchPromise = this.fetchModulesFromDB(uncachedCodes);
            this.pendingModuleRequests.set(batchKey, fetchPromise);
            
            // Clean up pending request after completion
            fetchPromise.finally(() => {
                this.pendingModuleRequests.delete(batchKey);
            });
        }

        const freshResults = await this.pendingModuleRequests.get(batchKey)!;
        
        // Update cache with fresh results
        for (const module of freshResults) {
            this.moduleCache.set(module.moduleCode, {
                moduleCode: module.moduleCode,
                title: module.title,
                moduleUnit: module.moduleUnit,
                description: module.description,
                department: module.department,
                faculty: module.faculty,
                timestamp: now
            });
        }

        return [...cachedResults, ...freshResults];
    }

    /**
     * Get prerequisite relationships with caching
     */
    async getBatchSimplePrerequisites(moduleCodes: ModuleCode[]): Promise<FEPrerequisiteData[]> {
        if (moduleCodes.length === 0) return [];

        const cachedResults: FEPrerequisiteData[] = [];
        const uncachedCodes: ModuleCode[] = [];
        const now = Date.now();

        // Check cache first
        for (const code of moduleCodes) {
            const cached = this.prerequisiteCache.get(code);
            if (cached && (now - cached.timestamp) < this.RULES_CACHE_TTL) {
                cachedResults.push({
                    moduleCode: code,
                    requiredModules: cached.data
                });
            } else {
                uncachedCodes.push(code);
            }
        }

        if (uncachedCodes.length === 0) {
            return cachedResults;
        }

        // Batch fetch uncached prerequisites
        const batchKey = uncachedCodes.sort().join(',');
        
        if (!this.pendingPrereqRequests.has(batchKey)) {
            const fetchPromise = this.fetchPrerequisitesFromDB(uncachedCodes);
            this.pendingPrereqRequests.set(batchKey, fetchPromise);
            
            fetchPromise.finally(() => {
                this.pendingPrereqRequests.delete(batchKey);
            });
        }

        const freshResults = await this.pendingPrereqRequests.get(batchKey)!;
        
        // Update cache
        for (const prereq of freshResults) {
            this.prerequisiteCache.set(prereq.moduleCode, {
                data: prereq.requiredModules,
                timestamp: now
            });
        }

        return [...cachedResults, ...freshResults];
    }

    /**
     * Get preclusion relationships with caching
     */
    async getBatchPreclusions(moduleCodes: ModuleCode[]): Promise<FEPreclusionData[]> {
        if (moduleCodes.length === 0) return [];

        const cachedResults: FEPreclusionData[] = [];
        const uncachedCodes: ModuleCode[] = [];
        const now = Date.now();

        // Check cache first
        for (const code of moduleCodes) {
            const cached = this.preclusionCache.get(code);
            if (cached && (now - cached.timestamp) < this.RULES_CACHE_TTL) {
                cachedResults.push({
                    moduleCode: code,
                    precludedModules: cached.data
                });
            } else {
                uncachedCodes.push(code);
            }
        }

        if (uncachedCodes.length === 0) {
            return cachedResults;
        }

        // Batch fetch uncached preclusions
        const batchKey = uncachedCodes.sort().join(',');
        
        if (!this.pendingPreclusionRequests.has(batchKey)) {
            const fetchPromise = this.fetchPreclusionsFromDB(uncachedCodes);
            this.pendingPreclusionRequests.set(batchKey, fetchPromise);
            
            fetchPromise.finally(() => {
                this.pendingPreclusionRequests.delete(batchKey);
            });
        }

        const freshResults = await this.pendingPreclusionRequests.get(batchKey)!;
        
        // Update cache
        for (const preclusion of freshResults) {
            this.preclusionCache.set(preclusion.moduleCode, {
                data: preclusion.precludedModules,
                timestamp: now
            });
        }

        return [...cachedResults, ...freshResults];
    }

    /**
     * Preload modules that are likely to be needed
     * Call this when the academic plan payload is received to warm the cache
     */
    async preloadModules(moduleCodes: ModuleCode[]): Promise<void> {
        // Preload in chunks to avoid overwhelming the database
        const CHUNK_SIZE = 50;
        const chunks = [];
        
        for (let i = 0; i < moduleCodes.length; i += CHUNK_SIZE) {
            chunks.push(moduleCodes.slice(i, i + CHUNK_SIZE));
        }

        // Load chunks in parallel but with some spacing
        await Promise.all(
            chunks.map((chunk, index) => 
                new Promise(resolve => 
                    setTimeout(() => {
                        this.getModulesDetails(chunk).then(resolve);
                    }, index * 100) // 100ms spacing between chunks
                )
            )
        );
    }

    /**
     * Clear all caches (useful for testing or when data updates are detected)
     */
    clearCache(): void {
        this.moduleCache.clear();
        this.prerequisiteCache.clear();
        this.preclusionCache.clear();
    }

    /**
     * Get cache statistics for debugging
     */
    getCacheStats(): {
        modulesCached: number;
        prerequisitesCached: number;
        preclusionsCached: number;
    } {
        return {
            modulesCached: this.moduleCache.size,
            prerequisitesCached: this.prerequisiteCache.size,
            preclusionsCached: this.preclusionCache.size
        };
    }

    // Private methods for actual database fetching

    private async fetchModulesFromDB(moduleCodes: ModuleCode[]): Promise<FEModuleData[]> {
        try {
            const { data, error } = await supabase
                .from('modules')
                .select('module_code, title, module_credit, description, department, faculty')
                .in('module_code', moduleCodes);

            if (error) {
                console.error('Error fetching modules:', error);
                return [];
            }

            return (data || []).map(module => ({
                moduleCode: module.module_code as ModuleCode,
                title: module.title,
                moduleUnit: this.parseModuleCredit(module.module_credit),
                description: module.description,
                department: module.department,
                faculty: module.faculty
            }));
        } catch (error) {
            console.error('Failed to fetch modules:', error);
            return [];
        }
    }

    private async fetchPrerequisitesFromDB(moduleCodes: ModuleCode[]): Promise<FEPrerequisiteData[]> {
        try {
            const { data, error } = await supabase
                .from('prerequisite_rules')
                .select('module_code, required_modules')
                .eq('rule_type', 'simple')
                .in('module_code', moduleCodes);

            if (error) {
                console.error('Error fetching prerequisites:', error);
                return [];
            }

            return (data || []).map(prereq => ({
                moduleCode: prereq.module_code as ModuleCode,
                requiredModules: Array.isArray(prereq.required_modules)
                    ? prereq.required_modules.map(m => m as ModuleCode)
                    : [] as ModuleCode[]
            }));
        } catch (error) {
            console.error('Failed to fetch prerequisites:', error);
            return [];
        }
    }

    private async fetchPreclusionsFromDB(moduleCodes: ModuleCode[]): Promise<FEPreclusionData[]> {
        try {
            const { data, error } = await supabase
                .from('preclusion_rules')
                .select('module_code, precluded_modules')
                .in('module_code', moduleCodes);

            if (error) {
                console.error('Error fetching preclusions:', error);
                return [];
            }

            return (data || []).map(preclusion => ({
                moduleCode: preclusion.module_code as ModuleCode,
                precludedModules: Array.isArray(preclusion.precluded_modules)
                    ? preclusion.precluded_modules.map(m => m as ModuleCode)
                    : [] as ModuleCode[]
            }));
        } catch (error) {
            console.error('Failed to fetch preclusions:', error);
            return [];
        }
    }

    /**
     * Parse module credit string to number
     * Handles formats like "4", "4.0", "4 AU", etc.
     */
    private parseModuleCredit(creditStr: string): number {
        if (!creditStr) return 4; // Default fallback
        
        const match = creditStr.match(/(\d+(?:\.\d+)?)/);
        if (match) {
            return parseFloat(match[1]);
        }
        
        return 4; // Default fallback for unparseable values
    }
}

// Export singleton instance
export const dbService = FrontendDatabaseService.getInstance();