import { BackendResponse, ProcessProgrammesRequest, ProcessProgrammesResponse } from "../types/shared-types";
import { beError } from "../services/errorHandler/be-error";

const backendURL = process.env.REACT_APP_BACKEND_URL;

// API to backend to populate programs based on user selections
export async function generateAP(
  req: ProcessProgrammesRequest
): Promise<BackendResponse<ProcessProgrammesResponse>> {
  try {
    const res = await fetch(`${backendURL}/api/academic-plan/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const data = await res.json();
      throw <beError>{
        response: {
          status: res.status,
          data
        }
      };
    }

    return res.json();
  } catch (err: unknown) {
    throw err; // Let the caller handle it with beErrorHandler
  }
}
