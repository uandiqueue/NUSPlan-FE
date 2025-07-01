import { 
    Programme,
    PopulatedProgramPayload
 } from "../types/shared/populator";

const backendURL = process.env.REACT_APP_BACKEND_URL;

// API to backend to populate programs based on user selections
export async function populateModules(payload: Programme[]): Promise<PopulatedProgramPayload[]> {
    const res = await fetch(`${backendURL}/api/populate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Backend error");
    return res.json();
}

