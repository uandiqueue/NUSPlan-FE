// No shared FE/BE types for now, so this is a bit messy
// This interfaces are from the backend
export interface Programme {
    name: string;
    type: "major" | "secondMajor" | "minor";
}
interface PopulateResponse {
    name: string;
    type: "major" | "secondMajor" | "minor";
    categorised: CategorisedModules;
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


// API to backend to populate programs based on user selections
export async function populateModules(payload: Programme[]): Promise<PopulateResponse[]> {
    const res = await fetch("http://localhost:4000/api/populate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Backend error");
    return res.json();
}
