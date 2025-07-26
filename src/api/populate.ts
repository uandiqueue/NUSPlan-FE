import { 
    BackendResponse,
    ProcessProgrammesRequest,
    ProcessProgrammesResponse
 } from "../types/shared-types";

const backendURL = process.env.REACT_APP_BACKEND_URL;

// API to backend to populate programs based on user selections
export async function populateModules(req: ProcessProgrammesRequest): Promise<BackendResponse<ProcessProgrammesResponse>> {
    const res = await fetch(`${backendURL}/api/academic-plan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
    });

    if (!res.ok) throw new Error("Backend error");
    return res.json();
}