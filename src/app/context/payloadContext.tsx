'use client';

import React, { createContext, useState, useMemo, ReactNode } from 'react';
import { PopulatedPayload, Course } from '../types/payload';
import { prereqSatisfied, findClash, tallyMC } from '../../lib/validate';

export interface PlannerContextValue {
  payload: PopulatedPayload;
  chosen: Course[];
  toggle: (course: Course, dropdownGroup?: string[]) => void;
  canPick: (course: Course) => boolean;
  progress: Record<string, number>;
}

export const PayloadContext = createContext<PlannerContextValue | null>(null);

export function PayloadProvider({
  initialPayload,
  children,
}: {
  initialPayload: PopulatedPayload;
  children: ReactNode;
}) {
  const [chosen, setChosen] = useState<Course[]>([]);
  const toggle = (course: Course, dropdownGroup?: string[]) =>
    setChosen((curr) => {
      const pickedSet = new Set(curr.map((c) => c.courseCode));
      if (pickedSet.has(course.courseCode)) {
        return curr.filter((c) => c.courseCode !== course.courseCode);
      }

      if (!prereqSatisfied(course.courseCode, pickedSet, initialPayload.lookup))
        return curr;

      if (findClash(course.courseCode, pickedSet, initialPayload.lookup))
        return curr;

      return dropdownGroup
        ? [
          ...curr.filter((c) => !dropdownGroup.includes(c.courseCode)),
          course,
        ]
        : [...curr, course];
    });

  const progress = useMemo(
    () => tallyMC(initialPayload, chosen),
    [chosen, initialPayload]
  );

  const picked = new Set(chosen.map((c) => c.courseCode));
  const canPick = (course: Course) =>
    picked.has(course.courseCode) ||
    (prereqSatisfied(course.courseCode, picked, initialPayload.lookup) &&
      !findClash(course.courseCode, picked, initialPayload.lookup));

  const value = { payload: initialPayload, chosen, toggle, canPick, progress };

  return (
    <PayloadContext.Provider value={value}>
      {children}
    </PayloadContext.Provider>
  );
}
