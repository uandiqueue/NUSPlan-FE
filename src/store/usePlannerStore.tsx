import { create } from 'zustand';
import type { ModuleCode } from '../types/nusmods-types';
import type { ProgrammePayload, LookupMaps, CourseBox } from '../types/shared-types';
import type {
  ValidationState,
  ValidationResult,
  ProgressState,
  PendingDecision,
  ModuleTag
} from '../types/frontend-types';
import { RealtimeValidator } from '../services/feRealtimeValidator';
import { Optimizer } from '../services/feOptimizer';
import { FulfilmentTracker } from '../services/feFulfilmentTracker';
import { dbService } from '../services/dbQuery';

export interface PlannerState {
  // Core data
  programmes: ProgrammePayload[];
  programme: ProgrammePayload;
  lookupMaps: LookupMaps;
  selectedProgramIndex: number;

  // Validation and UI state
  progressVersion: number;
  validationState: ValidationState;
  progressState: ProgressState;
  pendingDecision: PendingDecision | null;
  
  // Add prerequisite tracking
  prerequisiteBoxes: Map<ModuleCode, CourseBox[]>;
  moduleTagsCache: Map<ModuleCode, ModuleTag[]>;
  
  // Service instances
  validator: RealtimeValidator | null;
  optimizer: Optimizer | null;
  tracker: FulfilmentTracker | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  warnings: string[];
  
  // Actions
  loadProgrammes: (programmes: ProgrammePayload[], lookupMaps: LookupMaps) => Promise<void>;
  switchProgramme: (index: number) => void;
  selectModule: (module: ModuleCode, boxKey: string) => Promise<ValidationResult>;
  removeModule: (module: ModuleCode, boxKey: string) => Promise<void>;
  resolveDecision: (selectedOptions: string[]) => Promise<void>;
  cancelDecision: () => void;
  
  // Services for UI
  getModuleInfo: (module: ModuleCode) => Promise<any>;
  getModuleTags: (module: ModuleCode) => Promise<ModuleTag[]>;
  getPrerequisiteBoxes: (module: ModuleCode) => CourseBox[];
  getFilteredOptions: (boxOptions: ModuleCode[]) => Promise<any[]>;
  getProgressSummary: (programmeId: string) => Promise<any>;
  getRequirementTree: (programmeId: string) => Promise<any[]>;
  
  // Utility actions
  clearCaches: () => void;
  refreshData: () => Promise<void>;
  getSystemStats: () => any;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  // Initial state
  programmes: [],
  programme: {} as ProgrammePayload,
  lookupMaps: {} as LookupMaps,
  selectedProgramIndex: 0,
  
  progressVersion: 0,
  validationState: {
    maxRuleFulfillment: new Map(),
    strippedTags: new Map(),
    doubleCountUsage: new Map(),
    doubleCountModules: new Map(),
    moduleUsageCount: new Map(),
    violatingModules: new Set(),
    selectedModules: new Set(),
    moduleToBoxMapping: new Map()
  },
  
  progressState: {
    pathFulfillment: new Map(),
    pathModules: new Map(),
    programmeProgress: new Map(),
    ueCalculation: {
      required: 0,
      fulfilled: 0,
      autoIncludedModules: [],
      overflow: 0
    }
  },
  
  pendingDecision: null,
  
  // Initialize service integration state
  prerequisiteBoxes: new Map(),
  moduleTagsCache: new Map(),
  
  validator: null,
  optimizer: null,
  tracker: null,
  
  isLoading: false,
  error: null,
  warnings: [],

  /**
   * Load programmes and initialize all services
   */
  loadProgrammes: async (programmes, lookupMaps) => {
    set({ isLoading: true, error: null });
    
    try {
      // Initialize validation and progress states
      const validationState: ValidationState = {
        maxRuleFulfillment: new Map(),
        strippedTags: new Map(),
        doubleCountUsage: new Map(),
        doubleCountModules: new Map(),
        moduleUsageCount: new Map(),
        violatingModules: new Set(),
        selectedModules: new Set(),
        moduleToBoxMapping: new Map()
      };
      
      const progressState: ProgressState = {
        pathFulfillment: new Map(),
        pathModules: new Map(),
        programmeProgress: new Map(),
        ueCalculation: {
          required: 0,
          fulfilled: 0,
          autoIncludedModules: [],
          overflow: 0
        }
      };

      // Initialize services
      const validator = new RealtimeValidator(validationState, lookupMaps, programmes);
      const optimizer = new Optimizer(validator, lookupMaps, programmes);
      const tracker = new FulfilmentTracker(progressState, validator, lookupMaps, programmes);
      for (const programme of programmes) {
        const preselected = programme.preselectedModules || [];
        for (const mod of preselected) {
          await tracker.updateProgress(mod, 'ADD');
          await validator.updateValidationState(mod, '', 'ADD');
        }
      }

      set({
        programmes,
        programme: programmes[0],
        lookupMaps,
        validationState: {
          ...validationState,
          moduleToBoxMapping: new Map(validationState.moduleToBoxMapping),
        },
        progressState,
        validator,
        optimizer,
        tracker,
        selectedProgramIndex: 0,
        prerequisiteBoxes: new Map(),
        moduleTagsCache: new Map(),
        isLoading: false,
      });
      
    } catch (error) {
      console.error('Error loading programmes:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load programmes',
        isLoading: false
      });
    }
  },

  /**
   * Switch to a different programme view
   */
  switchProgramme: (index) => {
    const { programmes } = get();
    if (index >= 0 && index < programmes.length) {
      set({ selectedProgramIndex: index, programme: programmes[index] });
    }
  },

  /**
   * Select a module
   */
  selectModule: async (module, boxKey) => {
      const { validator, optimizer, tracker } = get();
      if (!validator || !optimizer || !tracker) {
          return {
              isValid: false,
              errors: ['Services not initialized'],
              warnings: [],
              requiresDecision: false
          };
      }

      set({ isLoading: true });
      try {
          // Perform validation
          const validationResult = await validator.validateSelection(module, boxKey);
          if (!validationResult.isValid) {
              set({
                  warnings: validationResult.errors,
                  isLoading: false
              });
              return validationResult;
          }

          // Check for prerequisite decision
          const prereqDecision = validator.getPrerequisiteDecisions(module);
          if (prereqDecision) {
              prereqDecision.boxKey = boxKey; // Set the boxKey
              set({
                  pendingDecision: prereqDecision,
                  isLoading: false
              });
              return { ...validationResult, requiresDecision: true };
          }

          // Check if double-count decision is required
          if (validationResult.requiresDecision && !prereqDecision) {
              const decision = await optimizer.createDoubleCountDecision(module, boxKey);
              if (decision) {
                  set({
                      pendingDecision: decision,
                      isLoading: false
                  });
                  return validationResult;
              }
          }

          // Handle prerequisite boxes
          const prereqBoxes = validator.getPrerequisiteBoxes(module);
          if (prereqBoxes && prereqBoxes.length > 0) {
              console.log(`Auto-adding ${prereqBoxes.length} prerequisite(s) for ${module}`);
              
              // Store prerequisite boxes
              set(state => ({
                  prerequisiteBoxes: new Map(state.prerequisiteBoxes).set(module, prereqBoxes)
              }));

              // Add prerequisites to tracking
              for (const prereqBox of prereqBoxes) {
                  if (prereqBox.kind === 'exact' && prereqBox.moduleCode) {
                      await validator.updateValidationState(prereqBox.moduleCode, prereqBox.boxKey, 'ADD');
                      await tracker.updateProgress(prereqBox.moduleCode, 'ADD');
                  }
              }
          }

          // Update validation state and progress for main module
          await validator.updateValidationState(module, boxKey, 'ADD');
          await tracker.updateProgress(module, 'ADD');

          const currentProgressState = get().progressState;
          const newProgressState = {
            ...currentProgressState,
            programmeProgress: new Map(currentProgressState.programmeProgress),
            pathFulfillment: new Map(currentProgressState.pathFulfillment),
            pathModules: new Map(currentProgressState.pathModules),
          };

          // Generate and cache module tags
          const tags = await optimizer.generateModuleTags(module);
          set(state => ({
              moduleTagsCache: new Map(state.moduleTagsCache).set(module, tags)
          }));

          // Update UI state
          set(state => ({
              validationState: {
                  ...state.validationState,
                  moduleToBoxMapping: new Map(state.validationState.moduleToBoxMapping),
              },
              progressState: newProgressState,
              warnings: validationResult.warnings,
              isLoading: false
          }));

          return validationResult;

      } catch (error) {
          console.error('Error selecting module:', error);
          const errorResult: ValidationResult = {
              isValid: false,
              errors: [error instanceof Error ? error.message : 'Unknown error'],
              warnings: [],
              requiresDecision: false
          };

          set({
              error: 'Failed to select module',
              isLoading: false
          });

          return errorResult;
      }
  },

  /**
   * Handle module removal with prerequisites
   */
  removeModule: async (module, boxKey) => {
    const { validator, tracker } = get();
    
    if (!validator || !tracker) return;

    set({ isLoading: true });
    
    try {
      // Remove prerequisite boxes first
      const prereqBoxes = get().prerequisiteBoxes.get(module);
      if (prereqBoxes) {
        for (const prereqBox of prereqBoxes) {
          if (prereqBox.kind === 'exact' && prereqBox.moduleCode) {
            await validator.updateValidationState(prereqBox.moduleCode, prereqBox.boxKey, 'REMOVE');
            await tracker.updateProgress(prereqBox.moduleCode, 'REMOVE');
          }
        }
        
        // Clear prerequisite boxes
        const newPrereqBoxes = new Map(get().prerequisiteBoxes);
        newPrereqBoxes.delete(module);
        set({ prerequisiteBoxes: newPrereqBoxes });
      }
      
      // Update validation state for main module
      await validator.updateValidationState(module, boxKey, 'REMOVE');
      
      // Update progress tracking for main module
      await tracker.updateProgress(module, 'REMOVE');
      
      // Clear cached tags
      const newTagsCache = new Map(get().moduleTagsCache);
      newTagsCache.delete(module);
      set({ moduleTagsCache: newTagsCache });
      
      // Update UI state
      set(state => ({
        validationState: {
          ...state.validationState,
          moduleToBoxMapping: new Map(state.validationState.moduleToBoxMapping),
        },
        progressState: { ...state.progressState },
        warnings: [],
        isLoading: false
      }));
      
    } catch (error) {
      console.error('Error removing module:', error);
      set({ 
        error: 'Failed to remove module',
        isLoading: false
      });
    }
  },

  /**
   * //Resolve decisions and update services
   */
  resolveDecision: async (selectedOptions) => {
      const { pendingDecision, validator, tracker, optimizer } = get();

      if (!pendingDecision || !validator || !tracker || !optimizer) return;

      set({ isLoading: true });

      try {
          if (pendingDecision.type === 'PREREQUISITE_CHOICE' && selectedOptions.length === 1) {
              const resolvedBoxes = await validator.applyPrerequisiteDecision(
                  pendingDecision.module,
                  selectedOptions[0]
              );

              // Store and process resolved prerequisite boxes
              if (resolvedBoxes.length > 0) {
                  set(state => ({
                      prerequisiteBoxes: new Map(state.prerequisiteBoxes).set(pendingDecision.module, resolvedBoxes)
                  }));

                  // Add prerequisites to validation state and tracker
                  for (const prereqBox of resolvedBoxes) {
                      if (prereqBox.kind === 'exact' && prereqBox.moduleCode) {
                          await validator.updateValidationState(prereqBox.moduleCode, prereqBox.boxKey, 'ADD');
                          await tracker.updateProgress(prereqBox.moduleCode, 'ADD');
                      }
                  }
              }

              // Add the main module
              await validator.updateValidationState(pendingDecision.module, pendingDecision.boxKey, 'ADD');
              await tracker.updateProgress(pendingDecision.module, 'ADD');
              
              console.log(`Resolved ${resolvedBoxes.length} prerequisite boxes for ${pendingDecision.module}`);
          } else {
              // Handle double-count decision
              await validator.applyDoubleCountDecision(pendingDecision.module, selectedOptions);
              await validator.updateValidationState(pendingDecision.module, pendingDecision.boxKey, 'ADD');
              await tracker.updateProgress(pendingDecision.module, 'ADD');
          }

          // Generate tags for the newly added module
          const tags = await optimizer.generateModuleTags(pendingDecision.module);
          set(state => ({
              moduleTagsCache: new Map(state.moduleTagsCache).set(pendingDecision.module, tags)
          }));
          
          // Clear pending decision
          set(state => ({
              validationState: {
                  ...state.validationState,
                  moduleToBoxMapping: new Map(state.validationState.moduleToBoxMapping),
              },
              progressState: { ...state.progressState },
              progressVersion: state.progressVersion + 1,
              pendingDecision: null,
              isLoading: false
          }));

      } catch (error) {
          console.error('Error resolving decision:', error);
          set({
              error: 'Failed to resolve decision',
              isLoading: false
          });
      }
  },

  /**
   * Cancel a pending decision
   */
  cancelDecision: () => {
    set({ pendingDecision: null });
  },

  /**
   * Get detailed module information
   */
  getModuleInfo: async (module) => {
    try {
      return await dbService.getModuleDetails(module);
    } catch (error) {
      console.error('Error getting module info:', error);
      return null;
    }
  },

  /**
   * Get module tags from optimizer
   */
  getModuleTags: async (module) => {
    const { optimizer, moduleTagsCache } = get();
    
    // Check cache first
    const cached = moduleTagsCache.get(module);
    if (cached) return cached;
    
    if (!optimizer) return [];
    
    try {
      const tags = await optimizer.generateModuleTags(module);
      
      // Cache the result
      set(state => ({
        moduleTagsCache: new Map(state.moduleTagsCache).set(module, tags)
      }));
      
      return tags;
    } catch (error) {
      console.error('Error getting module tags:', error);
      return [];
    }
  },

  /**
   * Get prerequisite boxes
   */
  getPrerequisiteBoxes: (module) => {
    return get().prerequisiteBoxes.get(module) || [];
  },

  /**
   * Use optimizer for filtered options
   */
  getFilteredOptions: async (boxOptions) => {
    const { optimizer } = get();
    if (!optimizer) return [];
    
    try {
      return await optimizer.getFilteredDropdownOptions(boxOptions);
    } catch (error) {
      console.error('Error getting filtered options:', error);
      return [];
    }
  },

  /**
   * Use tracker for progress summary
   */
  getProgressSummary: async (programmeId) => {
    const { tracker } = get();
    if (!tracker) return null;
    
    try {
      return await tracker.getDetailedProgressSummary(programmeId);
    } catch (error) {
      console.error('Error getting progress summary:', error);
      return null;
    }
  },

  /**
   * Use tracker for requirement tree
   */
  getRequirementTree: async (programmeId) => {
    const { tracker } = get();
    if (!tracker) return [];
    
    try {
      return await tracker.buildRequirementTree(programmeId);
    } catch (error) {
      console.error('Error getting requirement tree:', error);
      return [];
    }
  },

  /**
   * Clear all caches
   */
  clearCaches: () => {
    dbService.clearCache();
    set({
      moduleTagsCache: new Map(),
      prerequisiteBoxes: new Map()
    });
  },

  /**
   * Refresh data and caches
   */
  refreshData: async () => {
    const { programmes, lookupMaps } = get();
    get().clearCaches();
    await get().loadProgrammes(programmes, lookupMaps);
  },

  /**
   * Get system statistics for debugging
   */
  getSystemStats: () => {
    const { 
      validator, 
      optimizer, 
      tracker, 
      programmes, 
      validationState, 
      progressState,
      prerequisiteBoxes,
      moduleTagsCache
    } = get();
    
    const dbStats = dbService.getCacheStats();
    const validationStats = validator?.getValidationStats();
    const optimizerStats = optimizer?.getOptimizerStats();
    const trackerStats = tracker?.getTrackerStats();
    
    return {
      database: dbStats,
      validation: validationStats,
      optimizer: optimizerStats,
      tracker: trackerStats,
      programmes: {
        count: programmes.length,
        selectedIndex: get().selectedProgramIndex
      },
      state: {
        selectedModules: validationState.selectedModules.size,
        violatingModules: validationState.violatingModules.size,
        trackedPaths: progressState.pathFulfillment.size,
        hasPendingDecision: !!get().pendingDecision,
        prerequisiteBoxes: prerequisiteBoxes.size,
        cachedTags: moduleTagsCache.size
      }
    };
  }
}));