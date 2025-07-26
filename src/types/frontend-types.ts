// PROGRAMME SELECTION TYPES

export interface Programme {
  id: string;
  name: string;
  type: 'major' | 'secondMajor' | 'minor';
  required_units: number;
  double_count_cap: number;
}

export interface ProgrammeSelection {
  id: string;
  name: string;
}