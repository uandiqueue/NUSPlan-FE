import { PopulatedProgramPayload, CourseInfo } from "./shared/populator";

export interface PlannerContextValue {
    payload: PopulatedProgramPayload;
    chosen: CourseInfo[];
    toggle: (course: CourseInfo, dropdownGroup?: string[]) => void;
    canPick: (course: CourseInfo) => boolean;
    progress: Record<string, number>;
}