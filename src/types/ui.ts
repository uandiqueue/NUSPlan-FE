import { PopulatedProgramPayload, CourseInfo } from "./shared/populator";
import { ModuleCode } from "./shared/nusmods-types";

export interface UserSelection {
  course: CourseInfo;
  boxKey: string;
  requirementKey: string;
}

export interface PlannerContextValue {
  // All programs
  payloads: PopulatedProgramPayload[];

  // Currently selected program
  payload: PopulatedProgramPayload;

  // To change tabs (Primary Major, Secondary Major, Minors) in the PlannerPage
  selectedProgramIndex: number;
  setSelectedProgramIndex: (i: number) => void;

  // The courses the user has actually selected right now, changed CourseInfo[] to UserSelection[]
  chosen: UserSelection[];

  // Master toggle: called on any click
  toggle(course: CourseInfo, boxKey: string, reqreuimentKey: string, dropdownGroup?: string[]): void;

  // Should a course appear clickable/disabled?
  canPick(course: CourseInfo): boolean;

  // Requirement-fulfilment helper: call with a requirementKey
  progress: (rk: string) => { have: number; need: number; percent: number };

  // Human-readable prereq warnings after a course is selected
  warnings: string[];

  // CourseCodes that are currently precluded by what is chosen
  blocked: Set<ModuleCode>;

  // Tag-stripping map produced by max-cap logic
  // courseCode -> Tags that NO LONGER count for this programme
  stripped: Record<ModuleCode, string[]>;

  // Duplicate detection helpers for dropdowns
  isDuplicate: (courseCode: string, boxKey: string) => boolean;
  duplicateDropdowns: () => Array<{ courseCode: string; boxKeys: string[] }>;
}
