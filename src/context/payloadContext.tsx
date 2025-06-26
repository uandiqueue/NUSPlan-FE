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

import { normalisePayload } from '../services/validator/normalise';
import { validateSelection } from '../services/validator/realtime';

export const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({
    initialPayloads,
    children,
}: {
    initialPayloads: PopulatedProgramPayload[];
    children: ReactNode;
}) {
    // Store all normalized payloads (one per program)
    const flatPayloads = useMemo(
        () => initialPayloads.map(program => normalisePayload([program])),
        [initialPayloads],
    );

    // Track which tab/program is selected
    const [selectedProgramIndex, setSelectedProgramIndex] = useState(0);

    // Track chosen modules per program
    const [chosenProgram, setChosenProgram] = useState<CourseInfo[][]>(() => initialPayloads.map(() => []));

    // Run validator for all programs
    const validations = useMemo(
        () =>
            chosenProgram.map((program, index) =>
                validateSelection(program.map(module => module.courseCode), flatPayloads[index])),
        [chosenProgram, flatPayloads]
    );

    // Toggle helper
    const toggle = useCallback(
        (course: CourseInfo, dropdownGroup?: string[]) => {
            setChosenProgram(prev => {
                const updated = [...prev]; // Clone the top-level array
                const current = prev[selectedProgramIndex]; // Current program's selected modules
                const pickedSet = new Set(current.map(module => module.courseCode)); // Set to check if a module is already selected

                // If the course is already selected, remove it from the current list
                // Update the current program's slot in the array
                // Return the new array
                if (pickedSet.has(course.courseCode)) {
                    updated[selectedProgramIndex] = current.filter(module => module.courseCode !== course.courseCode);
                    return updated;
                }

                // If it is a dropdown selection group, remove any other module in the same group
                // Else just add the new module
                const base = dropdownGroup
                    ? current.filter(module => !dropdownGroup.includes(module.courseCode)) // remove all options in the same group
                    : current;
                const candidate = [...base, course];

                // Run validation on the current program's payload
                const candVal = validateSelection(candidate.map(c => c.courseCode), flatPayloads[selectedProgramIndex]);

                if (
                    candVal.blocked.has(course.courseCode) || // Candidate module appears in `blocked` - it is precluded
                    candVal.warnings.some(w => w.startsWith(`${course.courseCode} prerequisite`)) // Candidate produces a prereq warning that mentions itself
                ) {
                    // UI read this warning based on context.blocked later
                    return prev; // reject toggle
                }

                // Accept toggle
                updated[selectedProgramIndex] = candidate;
                return updated;
            });
        },
        [selectedProgramIndex, flatPayloads]
    );

    // Helper for UI to disable buttons
    // Disable or grey out courses that the user can no longer pick.
    // Prevent picking courses that:
    // Are precluded by something already selected.
    // Are still selectable but don’t fulfill any requirement anymore (fully stripped by cap rule).
    const canPick = useCallback(
        (course: CourseInfo) => {
            const validation = validations[selectedProgramIndex];
            const flat = flatPayloads[selectedProgramIndex];

            // Preclusion check
            if (validation.blocked.has(course.courseCode)) return false;

            // Cap-strip check
            const removed = new Set(validation.stripped[course.courseCode] ?? []);
            const allTags = flat.tags[course.courseCode] ?? [];

            // Keep course enabled if at least ONE tag survives
            const stillUseful = allTags.some(t => !removed.has(t));

            return stillUseful;
        },
        [selectedProgramIndex, validations, flatPayloads]
    );

    // Convenience getter
    const currentPayload = initialPayloads[selectedProgramIndex];
    const currentValidation = validations[selectedProgramIndex];
    const currentChosen = chosenProgram[selectedProgramIndex];

    // Context value (matches PlannerContextValue)
    const value: PlannerContextValue = {
        payload: currentPayload,
        payloads: initialPayloads,
        chosen: currentChosen,
        toggle,
        canPick,
        progress: currentValidation.progress,
        warnings: currentValidation.warnings,
        blocked: currentValidation.blocked,
        stripped: currentValidation.stripped,
        selectedProgramIndex,
        setSelectedProgramIndex
    };

    return (
        <PlannerContext.Provider value={value}>
            {children}
        </PlannerContext.Provider>
    );
}