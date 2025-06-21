import { create } from "zustand";

interface UIStore {
  showSecondarySelect: boolean;
  setShowSecondarySelect: (val: boolean) => void;
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  showSecondarySelect: false,
  setShowSecondarySelect: (val) => set({ showSecondarySelect: val }),
  errorMessage: "",
  setErrorMessage: (msg) => set({ errorMessage: msg }),
}));
