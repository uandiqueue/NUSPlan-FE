'use client';

import React, {
    createContext,
    useState,
    useMemo,
    useCallback,
    ReactNode,
} from 'react';

import type {
    PopulatedProgramPayload,
    CourseInfo,
} from '../types/shared/populator';
import type { PlannerContextValue } from '../types/ui';

import { normalisePayload }  from '../services/validator/normalise';
import { validateSelection } from '../services/validator/realtime';
export const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({
    initialPayload,
    children,
}: {
    initialPayload: PopulatedProgramPayload;
    children: ReactNode;
}) {
    // Flatten backend payload once
    const flat = useMemo(
        () => normalisePayload([initialPayload]),
        [initialPayload],
    );

    // Chosen courses
    const [chosen, setChosen] = useState<CourseInfo[]>([]);

    // Run validator every time chosen changes
    const validation = useMemo(
        () => validateSelection(chosen.map(c => c.courseCode), flat),
        [chosen, flat],
    );

    // Toggle helper
    const toggle = useCallback(
        (course: CourseInfo, dropdownGroup?: string[]) => {
            setChosen(curr => {
                const pickedSet = new Set(curr.map(m => m.courseCode));

                // Deselect
                // (One click do both add/remove course)
                if (pickedSet.has(course.courseCode)) {
                    return curr.filter(c => c.courseCode !== course.courseCode);
                }

                // Build candidate list 
                // (what the selected courses list will look like if accept this new selection)
                const base = dropdownGroup
                    ? curr.filter(c => !dropdownGroup.includes(c.courseCode))
                    : curr;
                const candidate = [...base, course];

                // Run validator once on candidate list
                const candVal = validateSelection(candidate.map(c => c.courseCode), flat);

                // If candidate module appears in `blocked` it is precluded
                if (candVal.blocked.has(course.courseCode)) {
                    // UI read this warning based on context.blocked later
                    return curr; // reject toggle
                }

                // If candidate produces a prereq warning that mentions itself
                if (
                    candVal.warnings.some(w => w.startsWith(`${course.courseCode} prerequisite`))
                ) {
                    // UI read this warning via context.warnings later
                    return curr; // reject toggle
                }

                // Else accept toggle
                return candidate;
            });
        },
        [flat],
    );

    // Helper for UI to disable buttons
    // Disable or grey out courses that the user can no longer pick.
    // Prevent picking courses that:
    // Are precluded by something already selected.
    // Are still selectable but don’t fulfill any requirement anymore (fully stripped by cap rule).
    const canPick = useCallback(
        (course: CourseInfo) => {
            // Preclusion check
            if (validation.blocked.has(course.courseCode)) return false;

            // Cap-strip check
            const removed   = new Set(validation.stripped[course.courseCode] ?? []);
            const allTags   = flat.tags[course.courseCode] ?? [];

            // Keep course enabled if at least ONE tag survives
            const stillUseful = allTags.some(t => !removed.has(t));

        return stillUseful;
        },
        [validation.blocked, validation.stripped, flat.tags],
    );

    // Context value (matches PlannerContextValue)
    const value: PlannerContextValue = {
        payload: initialPayload,
        chosen,
        toggle,
        canPick,
        progress: validation.progress,
        warnings: validation.warnings,
        blocked: validation.blocked,
        stripped: validation.stripped,
    };

    return (
        <PlannerContext.Provider value={value}>
            {children}
        </PlannerContext.Provider>
    );
}