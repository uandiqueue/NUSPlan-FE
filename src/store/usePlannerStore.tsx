import { create } from 'zustand';
import type { PopulatedProgramPayload, CourseInfo, CourseBox } from '../types/old/shared/populator';
import type { ModuleCode } from '../types/nusmods-types';
import { validateSelection } from '../services/validator/validateSelection';
import type {
    ValidationSnapshot,
    Choice,
    ProgrammeSlice,
    PlannerState
} from '../types/old/ui';
import { exportJson } from '../services/tester';

// helper function to collect all exact box choices (read-only courses)
function collectExactBoxChoices(payload: PopulatedProgramPayload): Choice[] {
    const choices: Choice[] = [];
    const visitBoxes = (boxes: CourseBox[]) => {
        for (const box of boxes) {
            if (box.kind === "exact") {
                choices.push({ boxKey: box.boxKey, course: box.course, kind: "exact" });
            }
        }
    };
    for (const section of payload.requirements) {
        visitBoxes(section.boxes);
    }
    return choices;
}

// helper function for validation Snapshot
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

export const usePlannerStore = create<PlannerState>((set, get) => ({
  programmes: [],
  selectedProgramIndex: 0,
  warnings: [],
  blocked: new Set<ModuleCode>(),
  progress: () => ({ 
    have: 0, 
    need: 0, 
    percent: 0 
  }), // program requirements fulfilment progress
  chosen: [],
  payloads: [],
  payload: {
    metadata: { 
      name: '', 
      type: 'major', 
      requiredUnits: 0, 
      doubleCountCap: 0, 
      nusTaughtFraction: 0.6 
    },
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

  // load the first programme into UI
  loadProgrammes: (payloads, lookups, fe2beList) => {
    const programmes: ProgrammeSlice[] = payloads.map((p, i) => ({
      payload: p,
      lookup: lookups[i],
      fe2be: fe2beList[i],
      picked: new Set<ModuleCode>(p.lookup.selected ?? []),
      chosen: [], // nothing picked yet in dropdown
    }));
    // check module conflicts and fulfilment progress
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
      nodeInfo: lookups[0].nodeInfo,
    });
  },

  // switch to another programme
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

  // select a course in the dropdown box
  toggle: (course, boxKey, requirementKey, kind, siblings) => {
    //console.log("toggle:", course.courseCode); // DEBUG
    const state = get();
    const idx = state.selectedProgramIndex;
    const currentProg = state.programmes[idx];
    const newPicked = new Set([...currentProg.picked]);
    //console.log("Current picked modules:", [...newPicked]); // DEBUG
    const newChosen = currentProg.chosen.filter(c => c.boxKey !== boxKey);
    //console.log("Current chosen courses:", newChosen); // DEBUG

    //console.log(state.blocked); // DEBUG
    if (state.blocked.has(course.courseCode)) {
      //console.warn(`${course.courseCode} blocked by validator`); // DEBUG
      return;
    }

    const already = currentProg.chosen.find(c => c.boxKey === boxKey);
    const stillChosenElsewhere = (code: string, arr: Choice[]) =>
      arr.some(c => c.course.courseCode === code); // check if this course still chosen in another box
    if (already && already.course.courseCode === course.courseCode) {
      if (!stillChosenElsewhere(course.courseCode, newChosen)) {
        newPicked.delete(course.courseCode);
      }
    } else {
      //console.log(`${course.courseCode} not selected, adding to dropdown`); // DEBUG
      if (already && !stillChosenElsewhere(already.course.courseCode, newChosen)) {
        newPicked.delete(already.course.courseCode);
      }
      newChosen.push({ boxKey, course, kind });
      //console.log(`${boxKey} now has ${course.courseCode}`); // DEBUG
      newPicked.add(course.courseCode);
      //console.log("Current picked modules:", [...newPicked]); // DEBUG
    }

    const updatedProgramme: ProgrammeSlice = {
      ...currentProg,
      picked: newPicked,
      chosen: newChosen,
    };
    //console.log("Updated programme:", updatedProgramme); // DEBUG
    const nextProgrammes = [...state.programmes];
    nextProgrammes[idx] = updatedProgramme;
    const validations = computeValidations(nextProgrammes);
    const curVal = validations[idx];

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