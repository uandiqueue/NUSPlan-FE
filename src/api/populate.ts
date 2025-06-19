// No shared FE/BE types for now, so this is a bit messy
// This interfaces are from the backend
import type { PopulatedPayload } from "../app/types/payload";

export interface PopulateResponse {
  populatedPayload: PopulatedPayload;
}

export interface Programme {
  name: string;
  type: "major" | "secondMajor" | "minor";
}
interface CategorisedModules {
  commonCore?: ModuleCondensed[];
  unrestrictedElectives?: ModuleCondensed[];
  coreEssentials?: ModuleCondensed[];
  coreElectives?: ModuleCondensed[];
  coreSpecials?: ModuleCondensed[];
  coreOthers?: ModuleCondensed[];

  constraints?: {
    doubleCountModules?: ModuleCondensed[];
    level1000Modules?: ModuleCondensed[];
    level2000Modules?: ModuleCondensed[];
    nonNUSModules?: ModuleCondensed[];
    nonUniqueModules?: ModuleCondensed[];
  };
}
type ModuleCondensed = Readonly<{
  moduleCode: ModuleCode;
  title: ModuleTitle;
  semesters: number[];
}>;
type ModuleCode = string;
type ModuleTitle = string;

const API_BASE = process.env.REACT_APP_API;

export async function populateModules(
  programmes: Programme[]
): Promise<PopulateResponse[]> {
  const res = await fetch(`${API_BASE}/api/populate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(programmes),
  });
  return res.json();
}

