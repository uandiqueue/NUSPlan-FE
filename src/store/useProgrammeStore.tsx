import { create } from "zustand";
import { supabase } from "../config/supabase";
import type { Programme, ProgrammeSelection } from "../types/frontend-types";

export interface ProgrammeSelections {
  userId: string;
  primaryMajor: ProgrammeSelection;
  secondaryMajor?: ProgrammeSelection | null;
  minors: ProgrammeSelection[];
}


interface MajorStore {
  // List of available programmes from db
  availableMajors: Programme[];
  availableSecondMajors: Programme[];
  availableMinors: Programme[];

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Selected programmes (storing both id and name)
  primaryMajor: ProgrammeSelection | null;
  secondaryMajor: ProgrammeSelection | null;
  minors: (ProgrammeSelection | null)[];

  // Actions
  loadUserProgrammeSelections: (userId: string) => Promise<void>
  saveUserProgrammeSelections: (selections: ProgrammeSelections) => Promise<void>
  fetchProgrammes: () => Promise<void>;
  setPrimaryMajor: (programme: ProgrammeSelection | null) => void;
  setSecondaryMajor: (programme: ProgrammeSelection | null) => void;
  addMinor: () => void;
  updateMinor: (programme: ProgrammeSelection | null, index: number) => void;
  deleteMinor: (index: number) => void;
  resetAll: () => void;
  getAllSelectedIds: () => string[];
  getAllSelectedNames: () => string[];
  isDuplicate: (programmeId: string) => boolean;
  getProgrammeById: (id: string) => Programme | undefined;
}

export const useMajorStore = create<MajorStore>()((set, get) => ({
  availableMajors: [],
  availableSecondMajors: [],
  availableMinors: [],
  isLoading: false,
  error: null,
  primaryMajor: null,
  secondaryMajor: null,
  minors: [],

  loadUserProgrammeSelections: async (userId) => {
    const { data, error } = await supabase
      .from("user_programme_selections")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows found
      throw error;
    }

    if (data) {
      set({
        primaryMajor: data.primary_major,
        secondaryMajor: data.secondary_major,
        minors: data.minors || [],
      });
    } else {
      set({
        primaryMajor: null,
        secondaryMajor: null,
        minors: [],
      });
    }
  },

  saveUserProgrammeSelections: async (selections) => {
    const { data, error } = await supabase
      .from("user_programme_selections")
      .upsert([{
        user_id: selections.userId,
        primary_major: selections.primaryMajor,
        secondary_major: selections.secondaryMajor,
        minors: selections.minors,
        updated_at: new Date().toISOString(),
      }], { onConflict: "user_id" });

    if (error) {
      console.error(error);
    }
  },

  // Fetch programmes from Supabase
  fetchProgrammes: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('programmes')
        .select('id, name, type, required_units, double_count_cap')
        .order('name');

      if (error) throw error;

      if (data) {
        const majors = data.filter(p => p.type === 'major');
        const secondMajors = data.filter(p => p.type === 'secondMajor');
        const minors = data.filter(p => p.type === 'minor');

        set({
          availableMajors: majors,
          availableSecondMajors: secondMajors,
          availableMinors: minors,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Error fetching programmes from Supabase:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch programmes',
        isLoading: false
      });
    }
  },

  setPrimaryMajor: (programme) => set({ primaryMajor: programme }),

  setSecondaryMajor: (programme) => set({ secondaryMajor: programme }),

  // For when the Add minor button is clicked
  addMinor: () => {
    set({ minors: [...get().minors, null] });
  },

  updateMinor: (programme, index) => {
    const newMinors = [...get().minors];
    newMinors[index] = programme;
    set({ minors: newMinors });
  },

  deleteMinor: (index) => {
    set({
      minors: get().minors.filter((_, i) => i !== index)
    });
  },

  resetAll: () => {
    set({
      primaryMajor: null,
      secondaryMajor: null,
      minors: [],
    });
  },

  // Get all selected programme IDs for backend
  getAllSelectedIds: () => {
    const { primaryMajor, secondaryMajor, minors } = get();
    const ids: string[] = [];

    if (primaryMajor?.id) ids.push(primaryMajor.id);
    if (secondaryMajor?.id) ids.push(secondaryMajor.id);

    minors.forEach(minor => {
      if (minor?.id) ids.push(minor.id);
    });

    return ids;
  },

  // Get all selected programme names for UI display
  getAllSelectedNames: () => {
    const { primaryMajor, secondaryMajor, minors } = get();
    const names: string[] = [];

    if (primaryMajor?.name) names.push(primaryMajor.name);
    if (secondaryMajor?.name) names.push(secondaryMajor.name);

    minors.forEach(minor => {
      if (minor?.name) names.push(minor.name);
    });

    return names;
  },

  // Check for duplicate selections
  isDuplicate: (programmeId: string) => {
    const selectedIds = get().getAllSelectedIds();
    return selectedIds.filter(id => id === programmeId).length > 1;
  },

  // Get programme details by ID
  getProgrammeById: (id: string) => {
    const { availableMajors, availableSecondMajors, availableMinors } = get();
    const allProgrammes = [...availableMajors, ...availableSecondMajors, ...availableMinors];
    return allProgrammes.find(p => p.id === id);
  },
}));
