import { create } from 'zustand';
import type { LookupTable, TagStripMap, RequirementNodeInfo } from '../types/feValidator';
import type { PopulatedProgramPayload, CourseInfo, CourseBox } from '../types/shared/populator';
import type { ModuleCode } from '../types/shared/nusmods-types';
import { validateSelection } from '../services/validator/validateSelection';
import type {
    ValidationSnapshot,
    Choice,
    ProgrammeSlice,
    PlannerState
} from '../types/ui';
import { exportJson } from '../services/tester';

// Helper function: Collect all exact box choices
function collectExactBoxChoices(payload: PopulatedProgramPayload): Choice[] {
    const choices: Choice[] = [];
    const visitBoxes = (boxes: CourseBox[]) => {
        for (const box of boxes) {
            if (box.kind === "exact") {
                choices.push({ boxKey: box.boxKey, course: box.course, kind: "exact" });
            }
            /*
            if (box.kind === "altPath") {
                for (const path of box.paths) {
                    visitBoxes(path.boxes);
                }
            }
             */
        }
    };
    for (const section of payload.requirements) {
        visitBoxes(section.boxes);
    }
    return choices;
}

// Helper function: Validation Snapshot
function computeValidations(programmes: ProgrammeSlice[]): ValidationSnapshot[] {
    if (!programmes.length) return [];
    // Union of all selected modules
    const unionPicked = new Set<ModuleCode>();
    programmes.forEach(p => p.picked.forEach(c => unionPicked.add(c)));
    const pickedArr = [...unionPicked];
    // Validate each programme in isolation but feed union list
    return programmes.map(p =>
        validateSelection(pickedArr, p.lookup, p.fe2be, p.chosen)
    );
}

export const usePlannerStore = create<PlannerState>()((set, get) => ({
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
        const programmes: ProgrammeSlice[] = payloads.map((p, i) => {
            const exactChoices = collectExactBoxChoices(p);
            const pickedCodes = [
                ...(p.lookup.selected ?? []),
                ...exactChoices.map(c => c.course.courseCode)
            ];
            return {
                payload: p,
                lookup: lookups[i],
                fe2be: fe2beList[i],
                picked: new Set<ModuleCode>(pickedCodes),
                chosen: [...exactChoices], // read-only courses
            };
        });
        const validations = computeValidations(programmes);
        set({
            programmes,
            selectedProgramIndex: 0,
            warnings: validations[0].warnings,
            blocked: validations[0].blocked,
            progress: validations[0].progress,
            chosen: programmes[0].chosen,
            payloads: programmes.map(p => p.payload),
            payload: programmes[0].payload,
            nodeInfo: programmes[0].lookup.nodeInfo,
        });
    },

    switchProgramme: (index: number) => {
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

    toggle: (
        course: CourseInfo,
        boxKey: string,
        requirementKey: string,
        kind: "exact" | "dropdown" | "altPath",
        siblings?: string[],
    ) => {
        const state = get();
        const idx = state.selectedProgramIndex;
        const currentProg = state.programmes[idx];

        // Clone picked and chosen
        const newPicked = new Set([...currentProg.picked]);
        const newChosen = currentProg.chosen.filter(c => c.boxKey !== boxKey);

        // Early-out if validator forbids the pick
        if (state.blocked.has(course.courseCode)) {
            console.warn(`Cannot pick ${course.courseCode}: blocked by validator.`);
            return;
        }

        // Check if the course is already selected in this dropdown
        const already = currentProg.chosen.find(c => c.boxKey === boxKey);

        // Helper: does some other box still hold this module
        const stillChosenElsewhere = (code: string, arr: Choice[]) =>
            arr.some(c => c.course.courseCode === code);

        if (already && already.course.courseCode === course.courseCode) {
            // If same course, unselect unless it's an exact
            if (already.kind !== "exact" && !stillChosenElsewhere(course.courseCode, newChosen)) {
                newPicked.delete(course.courseCode);
            }
        } else {
            // Replace with new course in dropdown
            if (already && already.kind !== "exact" && !stillChosenElsewhere(already.course.courseCode, newChosen))
                newPicked.delete(already.course.courseCode); // remove only if unique and not exact
            newChosen.push({ boxKey, course, kind });
            newPicked.add(course.courseCode);
        }

        // Create a completely new ProgrammeSlice object
        const updatedProgramme: ProgrammeSlice = {
            ...currentProg,
            picked: newPicked,
            chosen: newChosen,
        };

        // Replace programme in list
        const nextProgrammes = [...state.programmes];
        nextProgrammes[idx] = updatedProgramme;

        // Recompute validations using all selected modules
        const validations = computeValidations(nextProgrammes);
        const curVal = validations[idx];

        // Update Zustand store
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

    canPick: (course: CourseInfo) => {
        const { blocked } = get();
        return !blocked.has(course.courseCode);
    },

    isDuplicate: (courseCode: string, boxKey: string) => {
        const { programmes, selectedProgramIndex } = get();
        const picks = programmes[selectedProgramIndex]?.chosen ?? [];
        return picks.some(c => c.course.courseCode === courseCode && c.boxKey !== boxKey);
    }
}));
