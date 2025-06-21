import { create } from "zustand";

interface MajorStore {
  majorList: string[];
  primaryMajor: string;
  secondaryMajor: string;
  minors: string[];
  setPrimaryMajor: (major: string) => void;
  setSecondaryMajor: (major: string) => void;
  addMinor: () => void;
  updateMinor: (major: string, index: number) => void;
  deleteMinor: (index: number) => void;
  resetAll: () => void;
  getAllSelected: () => string[];
  isDuplicate: (major: string) => boolean;
}

export const useMajorStore = create<MajorStore>()((set, get) => ({
  majorList: [
    "Computer Science",
    "Business Analytics",
    "Life Sciences",
  ],
  primaryMajor: "",
  secondaryMajor: "",
  minors: [],
  setPrimaryMajor: (major) => set({ primaryMajor: major }),
  setSecondaryMajor: (major) => set({ secondaryMajor: major }),
  // For when the Add minor button is clicked
  addMinor: () => {
    set({ minors: [...get().minors, ""] });
  },
  updateMinor: (major, index) =>
    set({
      minors: [
        ...get().minors.slice(0, index), // flatten the array
        major,
        ...get().minors.slice(index + 1)
      ]
    }),
  deleteMinor: (index) =>
    set({
      minors: [
        ...get().minors.slice(0, index),
        ...get().minors.slice(index + 1)
      ]
    }),
  resetAll: () =>
    set({
      primaryMajor: "",
      secondaryMajor: "",
      minors: [],
    }),
  getAllSelected: () => {
    const { primaryMajor, secondaryMajor, minors } = get();
    return [
      primaryMajor ?? "",
      secondaryMajor ?? "",
      ...minors.map((major) => major ?? ""),
    ].filter(
      (item): item is string => typeof item === "string" && item.length > 0
    );
  },
  isDuplicate: (major) => {
    return get().getAllSelected().filter((m) => m === major).length > 1;
  },
}));
