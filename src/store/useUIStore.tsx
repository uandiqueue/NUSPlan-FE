import { create } from "zustand";

interface UIStore {
  showSecondarySelect: boolean;
  setShowSecondarySelect: (val: boolean) => void;
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
  confirmDeleteSecondary: boolean;
  setConfirmDeleteSecondary: (val: boolean) => void;
  confirmDeleteId: number | null;
  setConfirmDeleteId: (id: number | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  showSecondarySelect: false,
  setShowSecondarySelect: (val) => set({ showSecondarySelect: val }),
  errorMessage: "",
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  confirmDeleteSecondary: false,
  setConfirmDeleteSecondary: (val) => set({ confirmDeleteSecondary: val }),
  confirmDeleteId: null,
  setConfirmDeleteId: (id) => set({ confirmDeleteId: id }),
}));
