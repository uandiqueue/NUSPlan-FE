import { create } from "zustand";

export interface MinorEntry {
  id: number;
  value: string;
}

interface MajorStore {
  majorList: string[];
  primaryMajor: string;
  secondaryMajor: string;
  minors: MinorEntry[];
  setPrimaryMajor: (val: string) => void;
  setSecondaryMajor: (val: string) => void;
  deleteSecondary: () => void;
  addMinor: () => void;
  updateMinor: (id: number, value: string) => void;
  deleteMinor: (id: number) => void;
  resetAll: () => void;
  getAllSelected: () => string[];
  isDuplicate: (val: string) => boolean;
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
  setPrimaryMajor: (val) => set({ primaryMajor: val }),
  setSecondaryMajor: (val) => set({ secondaryMajor: val }),
  addMinor: () => {
    const newMinor = { id: Date.now(), value: "" };
    set({ minors: [...get().minors, newMinor] });
  },
  deleteSecondary: () => set({ secondaryMajor: "" }),
  updateMinor: (id, value) =>
    set({
      minors: get().minors.map((m) => (m.id === id ? { ...m, value } : m)),
    }),
  deleteMinor: (id) =>
    set({
      minors: get().minors.filter((m) => m.id !== id),
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
      ...minors.map((m) => m.value ?? ""),
    ].filter(
      (item): item is string => typeof item === "string" && item.length > 0
    );
  },
  isDuplicate: (val: string) => {
    return get().getAllSelected().includes(val);
  },
}));
