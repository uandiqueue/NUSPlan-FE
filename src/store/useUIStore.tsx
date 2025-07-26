import { create } from "zustand";

interface UIStore {
  showSecondarySelect: boolean;
  setShowSecondarySelect: (val: boolean) => void;
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
  userLoggedIn: boolean;
  setUserLoggedIn: (val: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  showSecondarySelect: false,
  setShowSecondarySelect: (val) => set({ showSecondarySelect: val }),
  errorMessage: "",
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  userLoggedIn: false,
  setUserLoggedIn: (val) => set({ userLoggedIn: val }),
}));
