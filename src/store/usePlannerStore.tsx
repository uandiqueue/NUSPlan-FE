import { create } from 'zustand';
import type { ModuleCode } from '../types/nusmods-types';
import type { ProgrammePayload, LookupMaps, CourseBox, RequirementGroupType } from '../types/shared-types';
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
import { supabase } from '../config/supabase';

// Data structures to save to database
export interface UserPathSelection {
  programmeId: string;
  groupType: RequirementGroupType;
  pathId: string;
}
export type UserPathSelections = UserPathSelection[];

export interface UserModuleSelection {
  programmeId: string;
  groupType: RequirementGroupType;
  pathId: string;
  boxKey: string;
  selectedModule: ModuleCode;
}
export type UserModuleSelections = UserModuleSelection[];

export interface UserAddedBox {
  programmeId: string;
  groupType: RequirementGroupType;
  box: CourseBox;
}
export type UserAddedBoxes = UserAddedBox[];

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

  prerequisiteBoxes: Map<ModuleCode, CourseBox[]>;
  moduleTagsCache: Map<ModuleCode, ModuleTag[]>;

  validator: RealtimeValidator | null;
  optimizer: Optimizer | null;
  tracker: FulfilmentTracker | null;

  isLoading: boolean;
  error: string | null;
  warnings: string[];

  // Path selections
  userPathSelections: UserPathSelections;
  setPathSelection: (programmeId: string, groupType: RequirementGroupType, pathId: string) => void;

  // Module selections
  userModuleSelections: UserModuleSelections;
  setBoxModuleSelection: (
    programmeId: string,
    groupType: RequirementGroupType,
    pathId: string,
    boxKey: string,
    selectedModule: ModuleCode
  ) => void;
  removeBoxModuleSelection: (
    programmeId: string,
    groupType: RequirementGroupType,
    pathId: string,
    boxKey: string
  ) => void;
  removeAllModulesUnderPath: (
    programmeId: string,
    groupType: RequirementGroupType,
    rootPathId: string,
    rootBox: CourseBox
  ) => void;

  userAddedBoxes: UserAddedBoxes;
  addUserBox: (programmeId: string, groupType: RequirementGroupType, box: CourseBox) => void;
  removeUserBox: (programmeId: string, groupType: RequirementGroupType, boxKey: string) => void;

  loadUserPlannerData: (userId: string) => Promise<void>;
  saveUserPlannerData: (userId: string) => Promise<void>;
  clearPlannerData: () => void;

  // Actions
  loadProgrammes: (programmes: ProgrammePayload[], lookupMaps: LookupMaps) => Promise<void>;
  switchProgramme: (index: number) => void;
  selectModule: (programmeId: string, groupType: RequirementGroupType, pathId: string, module: ModuleCode, boxKey: string) => Promise<ValidationResult>;
  removeModule: (programmeId: string, groupType: RequirementGroupType, pathId: string, boxKey: string) => Promise<void>;
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
  prerequisiteBoxes: new Map(),
  moduleTagsCache: new Map(),

  validator: null,
  optimizer: null,
  tracker: null,

  isLoading: false,
  error: null,
  warnings: [],
  userPathSelections: [],
  userModuleSelections: [],
  userAddedBoxes: [],

  loadUserPlannerData: async (userId) => {
    try {
      const { data, error } = await supabase
        .from("user_planner_data")
        .select("user_path_selections, user_module_selections, user_added_boxes")
        .eq("user_id", userId)
        .single();
      if (data) {
        set({
          userPathSelections: data.user_path_selections ?? [],
          userModuleSelections: data.user_module_selections ?? [],
          userAddedBoxes: data.user_added_boxes ?? []
        });
      }
      if (error && error.code !== "PGRST116") console.log("Error getting data from database: ", error);
    } catch (e) {
      console.error(e);
    }
  },

  saveUserPlannerData: async (userId) => {
    try {
      const state = get();
      const { error } = await supabase
        .from("user_planner_data")
        .upsert([{
          user_id: userId,
          user_path_selections: state.userPathSelections,
          user_module_selections: state.userModuleSelections,
          user_added_boxes: state.userAddedBoxes,
          updated_at: new Date().toISOString(),
        }], { onConflict: 'user_id' });
      if (error) console.log("Error saving data: ", error);
    } catch (e) {
      console.error(e);
    }
  },

  setPathSelection: (programmeId, groupType, pathId) => {
    set((state) => {
      const filtered = state.userPathSelections.filter(
        sel => !(sel.programmeId === programmeId && sel.groupType === groupType)
      );
      return {
        userPathSelections: [...filtered, { programmeId, groupType, pathId }]
      };
    });
  },

  setBoxModuleSelection: (programmeId, groupType, pathId, boxKey, selectedModule) => {
    set((state) => {
      const filtered = state.userModuleSelections.filter(
        sel =>
          !(
            sel.programmeId === programmeId &&
            sel.groupType === groupType &&
            sel.pathId === pathId &&
            sel.boxKey === boxKey
          )
      );
      return {
        userModuleSelections: [
          ...filtered,
          { programmeId, groupType, pathId, boxKey, selectedModule }
        ]
      };
    });
  },

  removeBoxModuleSelection: (programmeId, groupType, pathId, boxKey) => {
    set((state) => ({
      userModuleSelections: state.userModuleSelections.filter(
        sel =>
          !(
            sel.programmeId === programmeId &&
            sel.groupType === groupType &&
            sel.pathId === pathId &&
            sel.boxKey === boxKey
          )
      )
    }));
  },

  clearPlannerData: () => {
    set({
      userModuleSelections: [],
      userAddedBoxes: [],
      userPathSelections: [],
    });
  },

  removeAllModulesUnderPath: (programmeId, groupType, rootPathId, rootBox) => {
    function gatherBoxKeys(box: CourseBox): string[] {
      if (box.kind === "altPath" && Array.isArray(box.pathAlternatives)) {
        return [
          box.boxKey,
          ...box.pathAlternatives.flatMap(child => gatherBoxKeys(child))
        ];
      }
      return [box.boxKey];
    }
    const boxKeysToRemove = gatherBoxKeys(rootBox);

    set((state) => ({
      userModuleSelections: state.userModuleSelections.filter(
        sel =>
          !(
            sel.programmeId === programmeId &&
            sel.groupType === groupType &&
            sel.pathId === rootPathId &&
            boxKeysToRemove.includes(sel.boxKey)
          )
      )
    }));
  },

  addUserBox: (programmeId, groupType, box) => {
    set((state) => ({
      userAddedBoxes: [
        ...state.userAddedBoxes,
        { programmeId, groupType, box }
      ]
    }));
  },

  removeUserBox: (programmeId, groupType, boxKey) => {
    set((state) => ({
      userAddedBoxes: state.userAddedBoxes.filter(
        (item) =>
          !(
            item.programmeId === programmeId &&
            item.groupType === groupType &&
            item.box.boxKey === boxKey
          )
      )
    }));
  },

  loadProgrammes: async (programmes, lookupMaps) => {
    set({ isLoading: true, error: null });

    try {
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

      const exactBoxes = programmes[0].sections
        .flatMap(sec => sec.courseBoxes)
        .filter((box): box is Extract<CourseBox, { kind: 'exact' }> => box.kind === 'exact');

      for (const box of exactBoxes) {
        await validator.updateValidationState(box.moduleCode, box.boxKey, 'ADD');
        await tracker.updateProgress(box.moduleCode, 'ADD');
      }

      const initialSelections: UserModuleSelection[] = exactBoxes.map(box => ({
        programmeId: programmes[0].programmeId,
        groupType: programmes[0].sections.find(s => s.courseBoxes.includes(box))!.groupType,
        pathId: box.pathId,
        boxKey: box.boxKey,
        selectedModule: box.moduleCode
      }));

      set(state => ({
        userModuleSelections: [...state.userModuleSelections, ...initialSelections]
      }));

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
    } catch (error: any) {
      console.error('Error loading programmes:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load programmes',
        isLoading: false
      });
    }
  },


  switchProgramme: (index) => {
    const { programmes } = get();
    if (index >= 0 && index < programmes.length) {
      set({ selectedProgramIndex: index, programme: programmes[index] });
    }
  },

  selectModule: async (
    programmeId: string,
    groupType: RequirementGroupType,
    pathId: string,
    module: ModuleCode,
    boxKey: string
  ): Promise<ValidationResult> => {
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
      const validationResult = await validator.validateSelection(module, boxKey);
      if (!validationResult.isValid) {
        set({ warnings: validationResult.errors, isLoading: false });
        return validationResult;
      }

      const prereqDecision = validator.getPrerequisiteDecisions(module);
      if (prereqDecision) {
        prereqDecision.boxKey = boxKey;
        set({ pendingDecision: prereqDecision, isLoading: false });
        return { ...validationResult, requiresDecision: true };
      }

      if (validationResult.requiresDecision && !prereqDecision) {
        const decision = await optimizer.createDoubleCountDecision(module, boxKey);
        if (decision) {
          set({ pendingDecision: decision, isLoading: false });
          return validationResult;
        }
      }

      const prereqBoxes = validator.getPrerequisiteBoxes(module) ?? [];
      if (prereqBoxes.length > 0) {
        set(state => ({
          prerequisiteBoxes: new Map(state.prerequisiteBoxes).set(module, prereqBoxes)
        }));
        for (const p of prereqBoxes) {
          if (p.kind === 'exact' && p.moduleCode) {
            await validator.updateValidationState(p.moduleCode, p.boxKey, 'ADD');
            await tracker.updateProgress(p.moduleCode, 'ADD');
          }
        }
      }

      await validator.updateValidationState(module, boxKey, 'ADD');
      await tracker.updateProgress(module, 'ADD');

      set(state => ({
        progressVersion: state.progressVersion + 1,
        progressState: { ...state.progressState }
      }));

      get().setBoxModuleSelection(programmeId, groupType, pathId, boxKey, module);

      for (const p of prereqBoxes) {
        if (p.kind === 'exact' && p.moduleCode) {
          get().setBoxModuleSelection(
            programmeId,
            groupType,
            p.pathId,
            p.boxKey,
            p.moduleCode
          );
        }
      }

      const tags = await optimizer.generateModuleTags(module);
      set(state => ({
        moduleTagsCache: new Map(state.moduleTagsCache).set(module, tags)
      }));

      set(state => ({
        validationState: {
          ...state.validationState,
          moduleToBoxMapping: new Map(state.validationState.moduleToBoxMapping)
        },
        progressState: { ...state.progressState },
        warnings: validationResult.warnings,
        isLoading: false
      }));

      return validationResult;
    } catch (error: any) {
      console.error('Error selecting module:', error);
      set({ error: 'Failed to select module', isLoading: false });
      return {
        isValid: false,
        errors: [error.message || 'Unknown error'],
        warnings: [],
        requiresDecision: false
      };
    }
  },

  removeModule: async (
    programmeId,
    groupType,
    pathId,
    boxKey
  ) => {
    const { validator, tracker, userModuleSelections } = get();
    if (!validator || !tracker) return;

    set({ isLoading: true });
    try {
      const sel = userModuleSelections.find(s =>
        s.programmeId === programmeId &&
        s.groupType === groupType &&
        s.pathId === pathId &&
        s.boxKey === boxKey
      );
      if (sel) {
        const prereqs = get().prerequisiteBoxes.get(sel.selectedModule) || [];
        for (const p of prereqs) {
          if (p.kind === 'exact' && p.moduleCode) {
            await validator.updateValidationState(p.moduleCode, p.boxKey, 'REMOVE');
            await tracker.updateProgress(p.moduleCode, 'REMOVE');
          }
        }
        if (prereqs.length) {
          const m = new Map(get().prerequisiteBoxes);
          m.delete(sel.selectedModule);
          set({ prerequisiteBoxes: m });
        }

        await validator.updateValidationState(sel.selectedModule, boxKey, 'REMOVE');
        await tracker.updateProgress(sel.selectedModule, 'REMOVE');

        set(state => ({
          progressVersion: state.progressVersion + 1,
          progressState: { ...state.progressState }
        }));
      }

      get().removeBoxModuleSelection(programmeId, groupType, pathId, boxKey);

      set({ isLoading: false });
    } catch (e: any) {
      console.error(e);
      set({ error: 'Failed to remove module', isLoading: false });
    }
  },

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
        if (resolvedBoxes.length > 0) {
          set(state => ({
            prerequisiteBoxes: new Map(state.prerequisiteBoxes).set(pendingDecision.module, resolvedBoxes)
          }));
          for (const prereqBox of resolvedBoxes) {
            if (prereqBox.kind === 'exact' && prereqBox.moduleCode) {
              await validator.updateValidationState(prereqBox.moduleCode, prereqBox.boxKey, 'ADD');
              await tracker.updateProgress(prereqBox.moduleCode, 'ADD');
            }
          }
        }
        const tags = await optimizer.generateModuleTags(pendingDecision.module);
        set(state => ({
          moduleTagsCache: new Map(state.moduleTagsCache).set(pendingDecision.module, tags)
        }));
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
      } else {
        await validator.applyDoubleCountDecision(pendingDecision.module, selectedOptions);
        await validator.updateValidationState(pendingDecision.module, pendingDecision.boxKey, 'ADD');
        await tracker.updateProgress(pendingDecision.module, 'ADD');

        const tags = await optimizer.generateModuleTags(pendingDecision.module);
        set(state => ({
          moduleTagsCache: new Map(state.moduleTagsCache).set(pendingDecision.module, tags)
        }));

        set(state => ({
          validationState: { ...state.validationState },
          progressState: { ...state.progressState },
          pendingDecision: null,
          isLoading: false
        }));
      }
    } catch (error: any) {
      console.error('Error resolving decision:', error);
      set({
        error: 'Failed to resolve decision',
        isLoading: false
      });
    }
  },

  cancelDecision: () => {
    set({ pendingDecision: null });
  },

  getModuleInfo: async (module) => {
    try {
      return await dbService.getModuleDetails(module);
    } catch (error) {
      console.error('Error getting module info:', error);
      return null;
    }
  },

  getModuleTags: async (module) => {
    const { optimizer, moduleTagsCache } = get();
    const cached = moduleTagsCache.get(module);
    if (cached) return cached;
    if (!optimizer) return [];
    try {
      const tags = await optimizer.generateModuleTags(module);
      set(state => ({
        moduleTagsCache: new Map(state.moduleTagsCache).set(module, tags)
      }));
      return tags;
    } catch (error) {
      console.error('Error getting module tags:', error);
      return [];
    }
  },

  getPrerequisiteBoxes: (module) => {
    return get().prerequisiteBoxes.get(module) || [];
  },

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

  clearCaches: () => {
    dbService.clearCache();
    set({
      moduleTagsCache: new Map(),
      prerequisiteBoxes: new Map()
    });
  },

  refreshData: async () => {
    const { programmes, lookupMaps } = get();
    get().clearCaches();
    await get().loadProgrammes(programmes, lookupMaps);
  },

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
    const validationStats = validator?.getValidationStats?.();
    const optimizerStats = optimizer?.getOptimizerStats?.();
    const trackerStats = tracker?.getTrackerStats?.();

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
