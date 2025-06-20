export interface PopulatedPayload {
  metadata: {
    name: string;
    type: "major" | "minor" | "secondMajor";
    requiredUnits: number;
    doubleCountCap: number;
    nusTaughtFraction: number;
  };
  requirements: RequirementBlock[];
  moduleTags: ModuleTag[];
  lookup: LookupTables;
}

export interface RequirementBlock {
  requirementKey: string;
  label: string;
  requiredUnits: number;
  boxes: Box[];
}

export interface Course {
  courseCode: string;
  title: string;
  units: number;
}

export interface AltPath {
  id: string;
  boxes: Box[];
}

export type Box =
  | {
    kind: 'exact';
    boxKey: string;
    course: Course;
    UILabel: string;
    readonly: boolean;
  }
  | {
    kind: 'dropdown';
    boxKey: string;
    options: Course[];
    UILabel: string;
    readonly: boolean;
  }
  | {
    kind: 'altPath';
    boxKey: string;
    paths: AltPath[];
    UILabel: string;
    readonly: boolean;
  };

export interface TagMeta {
  type: "requirementKeys" | string;
  requirementKeys?: string[];
  [key: string]: unknown;
}

export interface ModuleTag {
  moduleCode: string;
  tags: TagMeta[];
}

export interface LookupTables {
  units: Record<string, number>;
  prereqs: Record<string, string[]>;
  preclusions: Record<string, string[]>;
  tags: Record<string, TagMeta[]>;
}

