import { supabase } from "../config/supabase";
import type { ModuleCode } from "../types/nusmods-types";
import type { LookupMaps } from "../types/shared-types";
import type {
  dbCache,
  ModuleData,
  RequirementPathData,
  GMCMappingData,
  PrerequisiteRule,
  PreclusionData
} from "../types/frontend-types";

/**
 * FEDatabaseQueryService class to handle database queries for FE.
 * It provides methods to fetch prerequisites, preclusions, module, and paths data from Supabase.
 */
export class FEDatabaseQueryService {

  private static instance: FEDatabaseQueryService;
  private cache: dbCache = {
    modules: new Map(),
    paths: new Map(),
    preclusions: new Map(),
    prerequisites: new Map(),
    gmcs: new Map(),
    isPreloaded: false
  };

  private constructor() { }

  public static getInstance(): FEDatabaseQueryService {
    if (!FEDatabaseQueryService.instance) {
      FEDatabaseQueryService.instance = new FEDatabaseQueryService();
    }
    return FEDatabaseQueryService.instance;
  }

  async preloadModules(moduleCodes: ModuleCode[]): Promise<void> {
    if (moduleCodes.length === 0) return;
    const modules = await this.getModulesDetails(moduleCodes);
    modules.forEach(m => this.cache.modules.set(m.module_code as ModuleCode, m));
  }

  /**
   * Initialize cache after user selects programmes.
   * 1. Extract all requirement paths using programmeIds
   * 2. After BE response, extract all moduleCodes from lookup maps and batch fetch everything
   */
  async initializeCache(
    programmeIds: string[],
    lookupMaps?: LookupMaps
  ): Promise<void> {
    console.log('Initializing cache...');

    // Fetch all requirement pathIds for these programmes
    try {
      console.log(`Fetching paths for programmes: ${programmeIds.join(', ')}`);
      const pathMap = await this.getRequirementPaths(programmeIds);
      const gmcsMap = await this.getGMCMappings(programmeIds);
      this.cache.paths = new Map(pathMap.map(path => [path.id, path]));

      // Group GMC mappings by gmc_code, map gmc_code to module_codes
      const gmcsGrouped = new Map<string, ModuleCode[]>();
      gmcsMap.forEach(gmc => {
        const arr = gmcsGrouped.get(gmc.gmc_code) || [];
        arr.push(gmc.module_code as ModuleCode);
        gmcsGrouped.set(gmc.gmc_code, arr);
      });
      this.cache.gmcs = gmcsGrouped;

    } catch (err) {
      console.error('Error fetching programme paths:', err);
      return;
    }

    if (!lookupMaps) {
      console.log('Waiting for LookupMap...');
      return;
    }

    // After LookupMaps are ready, build the module cache
    const allModuleCodes = this.extractAllModuleCodes(lookupMaps);
    const moduleCodes = Array.from(allModuleCodes);
    if (moduleCodes.length === 0) {
      console.warn('No module codes found in LookupMap.');
      return;
    }

    try {
      const [moduleDetails, preclusions] = await Promise.all([
        this.getModulesDetails(moduleCodes),
        this.getBatchPreclusions(moduleCodes)
      ]);

      // Cache module modules
      moduleDetails.forEach((moduleData: ModuleData) =>
        this.cache.modules.set(moduleData.module_code as ModuleCode, moduleData)
      );
      // Cache preclusions
      preclusions.forEach(pc =>
        this.cache.preclusions.set(pc.module_code as ModuleCode, pc)
      );

      this.cache.isPreloaded = true;
      console.log('Cache initialized successfully.');
    } catch (err) {
      console.error('Error initializing cache:', err);
    }
  }

  // MODULE QUERIES

  /**
   * Extract all unique module codes from moduleToLeafPaths in lookup.
   */
  extractAllModuleCodes(lookupMaps: LookupMaps): Set<ModuleCode> {
    const allModuleCodes = new Set<ModuleCode>();
    if (lookupMaps.moduleToLeafPaths) {
      Object.keys(lookupMaps.moduleToLeafPaths).forEach(moduleCode => {
        allModuleCodes.add(moduleCode as ModuleCode);
      });
    }
    return allModuleCodes;
  }

  async getModuleAU(moduleCode: ModuleCode): Promise<number> {
    try {
      // Check cache first
      const cached = this.cache.modules.get(moduleCode);
      if (cached) {
        return cached.module_credit ? Number(cached.module_credit) : 4; // Default to 4 units if not specified
      }

      // Not in cache, fetch individually using batch function
      const modules = await this.getModulesDetails([moduleCode]);
      if (modules.length === 0) {
        console.warn(`${moduleCode} not found in database, defaulting to 4 AU`);
        return 4;
      }

      // Cache the result
      this.cache.modules.set(moduleCode, modules[0]);
      return Number(modules[0].module_credit);
    } catch (error) {
      console.error(`Failed to query AU for ${moduleCode}:`, error);
      return 4;
    }
  }

  async getModuleDetails(moduleCode: ModuleCode): Promise<ModuleData | null> {
    try {
      // Check cache first
      const cached = this.cache.modules.get(moduleCode);
      if (cached) {
        return cached;
      }

      // Not in cache, fetch individually
      const modules = await this.getModulesDetails([moduleCode]);
      if (modules.length === 0) {
        console.warn(`${moduleCode} details not found in database`);
        return null;
      }

      // Cache the result
      this.cache.modules.set(moduleCode, modules[0]);
      return modules[0];
    } catch (error) {
      console.error(`Failed to query details for ${moduleCode}:`, error);
      return null;
    }
  }

  /**
   * Batch fetch module modules (no caching)
   */
  async getModulesDetails(moduleCodes: ModuleCode[]): Promise<ModuleData[]> {
    if (moduleCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('modules')
        .select(`
          module_code, title, module_credit, description, 
          department, faculty, aliases, 
          prerequisite, preclusion, semester_data
        `)
        .in('module_code', moduleCodes);

      if (error) {
        console.error('Error batch fetching module modules:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to batch fetch module modules:', error);
      return [];
    }
  }

  // PRECLUSION QUERIES

  async getModulePreclusions(moduleCode: ModuleCode): Promise<ModuleCode[]> {
    try {
      // Check cache first
      const cached = this.cache.preclusions.get(moduleCode);
      if (cached) {
        return Array.isArray(cached.precluded_modules) ?
          cached.precluded_modules.map(m => m as ModuleCode) : [];
      }

      // Not in cache, fetch using RPC function
      const { data, error } = await supabase.rpc('get_module_preclusions', {
        p_module_code: moduleCode
      });
      if (error) {
        console.error(`Error fetching preclusions for ${moduleCode}:`, error);
        return [];
      }

      // Cache the result
      this.cache.preclusions.set(moduleCode, data[0]);
      return Array.isArray((data[0] as PreclusionData).precluded_modules)
        ? (data[0] as PreclusionData).precluded_modules.map((m: string) => m as ModuleCode)
        : [];
    } catch (err) {
      console.error(`Failed to query preclusions for ${moduleCode}:`, err);
      return [];
    }
  }

  /**
   * Batch fetch preclusion data for multiple modules (no caching)
   */
  async getBatchPreclusions(moduleCodes: ModuleCode[]): Promise<PreclusionData[]> {
    if (moduleCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('preclusion_rules')
        .select('module_code, precluded_modules')
        .in('module_code', moduleCodes);

      if (error) {
        console.error('Error fetching batch preclusions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to query batch preclusions:', error);
      return [];
    }
  }

  // PATH QUERIES

  /**
   * Get all requirement paths for programmes (no caching)
   */
  async getRequirementPaths(programmeIds: string[]): Promise<RequirementPathData[]> {
    try {
      const { data, error } = await supabase
        .from('programme_requirement_paths')
        .select(`
          id, programme_id, path_key, parent_path_key, 
          display_label, logic_type, rule_type, rule_value, 
          required_units, depth, is_leaf, is_readonly, 
          group_type, raw_tag_name, module_codes, module_types,
          is_overall_source, exception_modules
        `)
        .in('programme_id', programmeIds)
        .order('depth', { ascending: true });

      if (error) {
        console.error('Error fetching requirement paths:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to query requirement paths:', error);
      return [];
    }
  }

  /**
   * Fetch requirement path by path id.
   */
  async getRequirementPathById(pathId: string): Promise<RequirementPathData | null> {
    // Check cache first
    const cached = this.cache.paths.get(pathId);
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('programme_requirement_paths')
        .select(`
          id, programme_id, path_key, parent_path_key, 
          display_label, logic_type, rule_type, rule_value, 
          required_units, depth, is_leaf, is_readonly, 
          group_type, raw_tag_name, module_codes, module_types,
          is_overall_source, exception_modules
        `)
        .eq('id', pathId)
        .single();
      if (error || !data) {
        console.error(`Error fetching requirement path for id ${pathId}:`, error);
        return null;
      }

      // Cache the result
      this.cache.paths.set(pathId, data as RequirementPathData);
      return data as RequirementPathData;
    } catch (error) {
      console.error(`Failed to query requirement path for id ${pathId}:`, error);
      return null;
    }
  }

  /**
   * Get pathId from pathKey
   */
  async getPathIdByKey(programmeId: string, pathKey: string): Promise<string | null> {
      try {
          const { data, error } = await supabase
              .from('programme_requirement_paths')
              .select('id')
              .eq('programme_id', programmeId)
              .eq('path_key', pathKey)
              .single();

          if (error) {
              console.error(`Error getting pathId for key ${pathKey}:`, error);
              return null;
          }
          return data?.id || null;
      } catch (error) {
          console.error(`Failed to get pathId for key ${pathKey}:`, error);
          return null;
      }
  }

  /**
   * Get pathKey from pathId
   */
  async getPathKeyById(pathId: string): Promise<string | null> {
      try {
          const { data, error } = await supabase
              .from('programme_requirement_paths')
              .select('path_key')
              .eq('id', pathId)
              .single();

          if (error) {
              console.error(`Error getting pathKey for id ${pathId}:`, error);
              return null;
          }
          return data?.path_key || null;
      } catch (error) {
          console.error(`Failed to get pathKey for id ${pathId}:`, error);
          return null;
      }
  }

  /**
   * Get parent pathIds for a given pathId
   */
  async getParentPathIds(pathId: string, programmeId: string): Promise<string[]> {
      try {
          // First get the pathKey for this pathId
          const currentPath = await this.getRequirementPathById(pathId);
          if (!currentPath || !currentPath.path_key) return [];

          const parentIds: string[] = [];
          let currentKey = currentPath.parent_path_key;

          // Walk up the hierarchy
          while (currentKey) {
              const parentPath = await supabase
                  .from('programme_requirement_paths')
                  .select('id, parent_path_key')
                  .eq('programme_id', programmeId)
                  .eq('path_key', currentKey)
                  .single();

              if (parentPath.data) {
                  parentIds.push(parentPath.data.id);
                  currentKey = parentPath.data.parent_path_key;
              } else {
                  break;
              }
          }

          return parentIds;
      } catch (error) {
          console.error(`Failed to get parent paths for ${pathId}:`, error);
          return [];
      }
  }

  // PREREQUISITE QUERIES

  /**
   * Get module prerequisites using RPC function
   */
  async getModulePrerequisites(moduleCode: ModuleCode): Promise<PrerequisiteRule[]> {
    try {
      // Check cache first
      const cached = this.cache.prerequisites.get(moduleCode);
      if (cached) {
        return cached as PrerequisiteRule[];
      }

      // Not in cache, fetch using RPC function
      const { data, error } = await supabase.rpc('get_module_prerequisites', {
        p_module_code: moduleCode
      });
      if (error) {
        console.error(`Error fetching prerequisites for ${moduleCode}:`, error);
        return [];
      }

      // Cache the result
      this.cache.prerequisites.set(moduleCode, data || []);
      return data || [];
    } catch (error) {
      console.error(`Failed to query prerequisites for ${moduleCode}:`, error);
      return [];
    }
  }

  // GMC MAPPING QUERIES

  /**
   * Get GMC mappings for programmes (no caching)
   */
  async getGMCMappings(programmeIds: string[], gmcCodes?: string[]): Promise<GMCMappingData[]> {
    try {
      let query = supabase
        .from('gmc_mappings')
        .select('gmc_code, gmc_type, module_code, programme_id')
        .in('programme_id', programmeIds);

      if (gmcCodes && gmcCodes.length > 0) {
        query = query.in('gmc_code', gmcCodes);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching GMC mappings:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Failed to query GMC mappings:', error);
      return [];
    }
  }

  /**
   * Get module codes by GMC using RPC function
   */
  async getModuleCodeByGMC(gmcCode: string): Promise<ModuleCode[]> {
    try {
      // Check cache first
      const cached = this.cache.gmcs.get(gmcCode);
      if (cached) {
        return cached;
      }

      // Not in cache, fetch using RPC function
      const { data, error } = await supabase.rpc('get_module_codes_by_gmc', {
        p_gmc_code: gmcCode
      });
      if (error) {
        console.error(`Error fetching module codes for ${gmcCode} (GMC):`, error);
        return [];
      }
      const moduleCodes = Array.isArray(data) ? data.map((m: string) => m as ModuleCode) : [];

      // Cache the result
      this.cache.gmcs.set(gmcCode, moduleCodes);
      return moduleCodes;
    } catch (err) {
      console.error(`Failed to query module codes for ${gmcCode} (GMC):`, err);
      return [];
    }
  }

  /**
   * Check if modules exist (for exact GMC validation)
   */
  async validateModuleCodes(moduleCodes: string[]): Promise<string[]> {
    if (moduleCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('modules')
        .select('module_code')
        .in('module_code', moduleCodes);

      if (error) {
        console.error('Error validating module codes:', error);
        return [];
      }

      return data?.map(m => m.module_code) || [];
    } catch (error) {
      console.error('Failed to validate module codes:', error);
      return [];
    }
  }

  getCacheStats(): {
    modulesCached: number;
    prerequisitesCached: number;
    preclusionsCached: number;
  } {
    return {
      modulesCached: this.cache.modules.size,
      prerequisitesCached: this.cache.prerequisites.size,
      preclusionsCached: this.cache.preclusions.size
    };
  }

  clearCache(): void {
    this.cache.modules.clear();
    this.cache.paths.clear();
    this.cache.preclusions.clear();
    this.cache.prerequisites.clear();
    this.cache.gmcs.clear();
    this.cache.isPreloaded = false;
  }

}

export const dbService = FEDatabaseQueryService.getInstance();