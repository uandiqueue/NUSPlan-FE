import { create } from 'zustand';
import type { ModuleCode } from '../types/nusmods-types';
import type { ProgrammePayload, LookupMaps } from '../types/shared-types';
import type {
    ValidationState,
    ValidationResult,
    ProgressState,
    PendingDecision
} from '../types/frontend-types';
import { RealtimeValidator } from '../services/feRealtimeValidator';
import { Optimizer } from '../services/feOptimizer';
import { FulfilmentTracker } from '../services/feFulfilmentTracker';
import { dbService } from '../services/dbQuery';

interface PlannerState {
    // Core data
    programmes: ProgrammePayload[];
    programme: ProgrammePayload;
    lookupMaps: LookupMaps;
    selectedProgramIndex: number;

    // Validation and UI state
    validationState: ValidationState;
    progressState: ProgressState;
    pendingDecision: PendingDecision | null;

    // Service instances
    validator: RealtimeValidator | null;
    optimizer: Optimizer | null;
    tracker: FulfilmentTracker | null;

    // UI state
    isLoading: boolean;
    error: string | null;
    warnings: string[];

    // Database integration status
    dbStatus: {
        isConnected: boolean;
        cacheStats: {
            modulesCached: number;
            prerequisitesCached: number;
            preclusionsCached: number;
        };
    };

    // Actions
    loadProgrammes: (programmes: ProgrammePayload[], lookupMaps: LookupMaps) => Promise<void>;
    switchProgramme: (index: number) => void;
    selectModule: (module: ModuleCode, boxKey: string) => Promise<ValidationResult>;
    removeModule: (module: ModuleCode, boxKey: string) => Promise<void>;
    resolveDecision: (selectedProgrammes: string[]) => Promise<void>;
    cancelDecision: () => void;
    getDuplicateModules: () => Set<ModuleCode>;

    // Enhanced getters with database integration
    getModuleInfo: (module: ModuleCode) => Promise<any>;
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
    validator: null,
    optimizer: null,
    tracker: null,

    isLoading: false,
    error: null,
    warnings: [],

    dbStatus: {
        isConnected: false,
        cacheStats: {
            modulesCached: 0,
            prerequisitesCached: 0,
            preclusionsCached: 0
        }
    },

    /**
     * Load programmes and initialize all services with database integration
     */
    loadProgrammes: async (programmes, lookupMaps) => {
        set({ isLoading: true, error: null });

        try {
            // console.log('Loading programmes with database integration...'); // DEBUGGING PURPOSES

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

            // Get database status
            const cacheStats = dbService.getCacheStats();

            set({
                programmes,
                programme: programmes[0],
                lookupMaps,
                validationState,
                progressState,
                validator,
                optimizer,
                tracker,
                selectedProgramIndex: 0,
                isLoading: false,
                dbStatus: {
                    isConnected: true,
                    cacheStats
                }
            });

            // console.log('Programmes loaded successfully with database integration'); // DEBUGGING PURPOSES

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
     * Select a module with enhanced validation and database integration
     */
    selectModule: async (module, boxKey) => {
        const { validator, optimizer, tracker, validationState } = get();

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

            // Check if decision is required
            if (validationResult.requiresDecision) {
                const decision = await optimizer.createDoubleCountDecision(module, boxKey);
                if (decision) {
                    set({
                        pendingDecision: decision,
                        isLoading: false
                    });
                    return validationResult;
                }
            }

            // Update validation state
            await validator.updateValidationState(module, boxKey, 'ADD');

            // Update progress tracking
            await tracker.updateProgress(module, 'ADD');

            // Update UI state
            set(state => ({
                validationState: { ...state.validationState },
                progressState: { ...state.progressState },
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
     * Remove a module with database-integrated cleanup
     */
    removeModule: async (module, boxKey) => {
        const { validator, tracker } = get();

        if (!validator || !tracker) return;

        set({ isLoading: true });

        try {
            // Update validation state
            await validator.updateValidationState(module, boxKey, 'REMOVE');

            // Update progress tracking
            await tracker.updateProgress(module, 'REMOVE');

            // Update UI state
            set(state => ({
                validationState: { ...state.validationState },
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
     * Resolve a pending decision (e.g., double-count allocation)
     */
    resolveDecision: async (selectedProgrammes) => {
        const { pendingDecision, validator, tracker } = get();

        if (!pendingDecision || !validator || !tracker) return;

        set({ isLoading: true });

        try {
            // Apply the decision
            await validator.applyDoubleCountDecision(pendingDecision.module, selectedProgrammes);

            // Update validation state
            await validator.updateValidationState(pendingDecision.module, pendingDecision.boxKey, 'ADD');

            // Update progress tracking
            await tracker.updateProgress(pendingDecision.module, 'ADD');

            // Clear pending decision
            set(state => ({
                validationState: { ...state.validationState },
                progressState: { ...state.progressState },
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

    getDuplicateModules: () => {
        const { moduleToBoxMapping } = get().validationState;
        const duplicates: Set<ModuleCode> = new Set();
        moduleToBoxMapping.forEach((boxes, module) => {
            if (boxes.size > 1) {
                duplicates.add(module);
            }
        });
        return duplicates;
    },

    /**
     * Get detailed module information with database integration
     */
    getModuleInfo: async (module) => {
        const { optimizer } = get();
        if (!optimizer) return null;

        try {
            return await optimizer.getModuleInfo(module);
        } catch (error) {
            console.error('Error getting module info:', error);
            return null;
        }
    },

    /**
     * Get filtered dropdown options with enhanced module details
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
     * Get detailed progress summary for a programme
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
     * Get requirement tree with accurate progress data
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
     * Clear all caches (useful for debugging or data refresh)
     */
    clearCaches: () => {
        const { validator, optimizer, tracker } = get();

        dbService.clearCache();
        optimizer?.clearCaches();
        tracker?.clearCaches();

        // Update cache stats
        const cacheStats = dbService.getCacheStats();
        set(state => ({
            dbStatus: {
                ...state.dbStatus,
                cacheStats
            }
        }));
    },

    /**
     * Refresh data and caches
     */
    refreshData: async () => {
        const { programmes, lookupMaps } = get();

        // Clear caches first
        get().clearCaches();

        // Reload programmes
        await get().loadProgrammes(programmes, lookupMaps);
    },

    /**
     * Get comprehensive system statistics for debugging
     */
    getSystemStats: () => {
        const { validator, optimizer, tracker, programmes, validationState, progressState } = get();

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
                hasPendingDecision: !!get().pendingDecision
            }
        };
    }
}));