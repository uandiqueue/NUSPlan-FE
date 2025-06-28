import { create } from 'zustand';
import type { LookupTable, TagStripMap, RequirementNodeInfo } from '../types/feValidator';
import type { PopulatedProgramPayload, CourseInfo } from '../types/shared/populator';
import type { ModuleCode } from '../types/shared/nusmods-types';
import { validateSelection } from '../services/validator/validateSelection';

/* 
Multi‑programme planner store:
- handles multiple lookup tables (majors/minors)
- keeps a separate <picked Set> for each programme
- derives validation results for each programme from the union of
all selected modules (so cross‑programme clashes are detected)
*/

/* TYPES */
export interface Progress { 
    have: number; 
    need: number; 
    percent: number; 
}

interface ValidationSnapshot {
    warnings: string[];
    blocked: Set<ModuleCode>;
    stripped: TagStripMap;
    progress: (feKey: string) => Progress;
}

interface Choice { boxKey: string; course: CourseInfo; }

interface ProgrammeSlice {
    payload: PopulatedProgramPayload;
    lookup: LookupTable;
    // FE=>BE key translation dictionaries
    // FE keys (colon‑separated, prefixed by programme id) power the UI tree
    // BE keys (original requirementKey/boxKey) stay intact for FE-BE round‑trips
    fe2be: Record<string, string>;
    picked: Set<ModuleCode>; // Modules selected in this programme
    chosen: Choice[]; // Mapping dropdown-boxKey -> chosen Course
}

interface PlannerState {
    // Core
    programmes: ProgrammeSlice[]; // one slice per major/minor
    selectedProgramIndex: number; // active tab

    // Derived (from current tab)
    warnings: string[];
    blocked: Set<ModuleCode>;
    progress: (feKey: string) => Progress;
    chosen: Choice[];
    payloads: PopulatedProgramPayload[];
    payload: PopulatedProgramPayload;
    nodeInfo: Record<string, RequirementNodeInfo>;

    // Actions
    loadProgrammes: (
        payloads: PopulatedProgramPayload[],
        lookups: LookupTable[],
        fe2beList: Record<string, string>[]
    ) => void;
    switchProgramme: (index: number) => void;
    toggle: (
        course: CourseInfo,
        boxKey: string,
        requirementKey: string,
        siblings?: string[]
    ) => void;
    canPick: (course: CourseInfo) => boolean;
    isDuplicate: (courseCode: string, boxKey: string) => boolean;
}


/* STORE */
export const usePlanner = create<PlannerState>((set, get) => ({

    // State
    programmes: [],
    selectedProgramIndex: 0,
    warnings: [],
    blocked: new Set<ModuleCode>(),
    progress: () => ({ have: 0, need: 0, percent: 0 }),
    chosen: [],
    payloads: [],
    payload: {
        metadata: { name: '', type: 'major', requiredUnits: 0, doubleCountCap: 0, nusTaughtFraction: 0.6 },
        requirements: [],
        moduleTags: [],
        lookup: {
            tags: {},
            units: {},
            prereqs: {},
            preclusions: {},
            minRequirements: {},
            maxRequirements: {},
            selected: [],
            version: 0
        }
    },
    nodeInfo: {},

    // Actions
    loadProgrammes: (payloads, lookups, fe2beList) => {
        const programmes: ProgrammeSlice[] = payloads.map((p, i) => ({
            payload: p,
            lookup: lookups[i],
            fe2be: fe2beList[i],
            picked: new Set<ModuleCode>(p.lookup.selected ?? []),
            chosen: [], // nothing picked yet in dropdown
        }));
        // run validation once per programme using union of picks
        const validations = computeValidations(programmes);
        // inject derived fields for first tab
        set({
            programmes,
            selectedProgramIndex: 0,
            warnings: validations[0].warnings,
            blocked: validations[0].blocked,
            progress: validations[0].progress,
            chosen: programmes[0].chosen,
            payloads: programmes.map(p => p.payload),
            payload: programmes[0].payload,
            nodeInfo: lookups[0].nodeInfo,
        });
    },

    switchProgramme: (index) => {
        const programmes = get().programmes;
        if (!programmes.length) return;
        const validations = computeValidations(programmes);
        set({
            selectedProgramIndex: index,
            warnings: validations[index].warnings,
            blocked: validations[index].blocked,
            progress: validations[index].progress,
            chosen: programmes[index].chosen,
            payload: programmes[index].payload,
            nodeInfo: programmes[index].lookup.nodeInfo,
        });
    },

    toggle: (course, boxKey, requirementKey, siblings) => {
        //console.log("TOGGLED:", course.courseCode); // DEBUG

        const state = get();
        const idx = state.selectedProgramIndex;
        const currentProg = state.programmes[idx];

        // 1. Clone picked and chosen
        const newPicked = new Set([...currentProg.picked]);
        const newChosen = currentProg.chosen.filter(c => c.boxKey !== boxKey);

        const already = currentProg.chosen.find(c => c.boxKey === boxKey);

        if (already && already.course.courseCode === course.courseCode) {
            // If same course, unselect
            newPicked.delete(course.courseCode);
        } else {
            // Replace with new course in dropdown
            newChosen.push({ boxKey, course });
            siblings?.forEach(code => newPicked.delete(code));
            newPicked.add(course.courseCode);
        }

        // 2. Create a completely new ProgrammeSlice object
        const updatedProgramme: ProgrammeSlice = {
            ...currentProg,
            picked: newPicked,
            chosen: newChosen,
        };
        //console.log("Updated programme:", updatedProgramme); // DEBUG

        // 3. Replace programme in list
        const nextProgrammes = [...state.programmes];
        nextProgrammes[idx] = updatedProgramme;

        // 4. Recompute validations using all selected modules
        const validations = computeValidations(nextProgrammes);
        const curVal = validations[idx];

        // 5. Update Zustand store
        set({
            programmes: nextProgrammes,
            warnings: curVal.warnings,
            blocked: curVal.blocked,
            progress: curVal.progress,
            chosen: updatedProgramme.chosen,
            payload: updatedProgramme.payload,
            nodeInfo: updatedProgramme.lookup.nodeInfo,
        });
    },

    canPick: (course) => {
        const { blocked } = get();
        return !blocked.has(course.courseCode);
    },

    isDuplicate: (courseCode, boxKey) => {
        // same course picked in a different dropdown inside this programme
        const { programmes, selectedProgramIndex } = get();
        const picks = programmes[selectedProgramIndex]?.chosen ?? [];
        return picks.some(c => c.course.courseCode === courseCode && c.boxKey !== boxKey);
    }

}));

// Helpers

function computeValidations(programmes: ProgrammeSlice[]): ValidationSnapshot[] {
    if (!programmes.length) return [];

    // 1. union of all selected modules (cross-programme clashes)
    const unionPicked = new Set<ModuleCode>();
    programmes.forEach(p => p.picked.forEach(c => unionPicked.add(c)));
    const pickedArr = [...unionPicked];

    // 2. validate each programme in isolation but feed union list
    return programmes.map(p =>
        validateSelection(pickedArr, p.lookup, p.fe2be)
    );
}