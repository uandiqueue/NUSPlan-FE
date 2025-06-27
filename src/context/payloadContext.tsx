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
import type { PlannerContextValue, UserSelection } from '../types/ui';

import { normalisePayload } from '../services/validator/normalise';
import { validateSelection } from '../services/validator/realtime';

import { useUIStore } from '../store/useUIStore';

export const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({
    initialPayloads,
    children,
}: {
    initialPayloads: PopulatedProgramPayload[];
    children: ReactNode;
}) {
    const { setErrorMessage } = useUIStore();

    // Store all normalized payloads (one per program)
    const flatPayloads = useMemo(
        () => initialPayloads.map(program => normalisePayload([program])),
        [initialPayloads],
    );

    // Track which tab/program is selected
    const [selectedProgramIndex, setSelectedProgramIndex] = useState(0);

    // Track chosen modules per program
    const [chosenProgram, setChosenProgram] = useState<UserSelection[][]>(() => initialPayloads.map(() => []));

    {/* Duplication detections */ }
    // Find duplicates for current program
    const duplicateDropdowns = useCallback(() => {
        const currentProgram = chosenProgram[selectedProgramIndex];
        const countTracker: Record<string, string[]> = {};
        currentProgram.forEach(sel => {
            if (!countTracker[sel.course.courseCode]) {
                countTracker[sel.course.courseCode] = [];
            }
            countTracker[sel.course.courseCode].push(sel.boxKey);
        });

        return Object.entries(countTracker)
            .filter(([_, boxKeys]) => boxKeys.length > 1)
            .map(([courseCode, boxKeys]) => ({ courseCode, boxKeys }));
    }, [chosenProgram, selectedProgramIndex]);

    // Find if a specific courseCode/ boxKey is a duplicate
    const isDuplicate = (courseCode: string, boxKey: string) => {
        const currentProgram = chosenProgram[selectedProgramIndex];
        return (
            currentProgram.filter(sel => sel.course.courseCode === courseCode).length > 1 &&
            currentProgram.some(sel => sel.boxKey === boxKey && sel.course.courseCode === courseCode)
        );
    };

    // Toggle helper
    const toggle = useCallback(
        (course: CourseInfo, boxKey: string, requirementKey: string, dropdownGroup?: string[]) => {
            setChosenProgram(prev => {
                const updated = [...prev]; // Clone the top-level array
                const current = prev[selectedProgramIndex]; // Current program's selected modules

                // Remove current box's selection
                let next = current.filter(sel => sel.boxKey !== boxKey);

                /*
                // If dropdownGroup, remove all others in the group
                if (dropdownGroup) {
                    next = next.filter(sel => !dropdownGroup.includes(sel.course.courseCode));
                }
                 */

                // Add new selection
                next.push({ course, boxKey, requirementKey });

                updated[selectedProgramIndex] = next;
                return updated;
            });

            setErrorMessage("");
        },
        [selectedProgramIndex]
    );

    // Run validator for current chosen courses
    const validations = useMemo(
        () =>
            chosenProgram.map((program, index) =>
                validateSelection(program.map(sel => sel.course.courseCode), flatPayloads[index])),
        [chosenProgram, flatPayloads]
    );

    // UI disables blocked/precluded courses for guidance only (optional)
    const canPick = useCallback(
        (course: CourseInfo) => {
            const validation = validations[selectedProgramIndex];
            const flat = flatPayloads[selectedProgramIndex];

            if (validation.blocked.has(course.courseCode)) return false;

            const removed = new Set(validation.stripped[course.courseCode] ?? []);
            const allTags = flat.tags[course.courseCode] ?? [];
            const stillUseful = allTags.some(t => !removed.has(t));
            return stillUseful;
        },
        [selectedProgramIndex, validations, flatPayloads]
    );

    // Compose warnings: validator + duplicate dropdowns
    const duplicateWarnings = duplicateDropdowns().map(
        d => `Duplicate course selected in multiple dropdowns: ${d.courseCode}`
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
        warnings: [
            ...currentValidation.warnings,
            ...duplicateWarnings,
        ],
        blocked: currentValidation.blocked,
        stripped: currentValidation.stripped,
        selectedProgramIndex,
        setSelectedProgramIndex,
        // Optional helpers for BoxRenderer:
        isDuplicate,
        duplicateDropdowns,
    };

    return (
        <PlannerContext.Provider value={value}>
            {children}
        </PlannerContext.Provider>
    );
}