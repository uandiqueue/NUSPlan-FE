import { useState, useEffect } from "react";
import { Box, Typography, Button, Snackbar, CircularProgress, Alert } from "@mui/material";
import { useMajorStore } from "../store/useMajorStore";
import { useUIStore } from "../store/useUIStore";
import InputPrimaryMajor from "../components/InputPrimaryMajor";
import InputSecondaryMajor from "../components/InputSecondaryMajor";
import InputMinor from "../components/InputMinor";
import AddSecondary from "../components/AddSecondary";
import AddMinor from "../components/AddMinor";
import { generateAP } from "../api/apGeneration";
// import type { Programme, PopulatedProgramPayload } from "../types/shared/populator";
import PlannerPage from "./PlannerPage";
import { usePlannerStore } from "../store/usePlannerStore";
import type { LookupTable } from "../types/old/feValidator";
import { normalisePayload } from "../services/validator/normalise";
import { exportJson } from "../services/tester";
import { supabase } from "../config/supabase";
import { beError, beErrorHandler } from "../services/errorHandler/be-error";
import { 
  BackendResponse, 
  ProgrammePayload, 
  ProcessProgrammesRequest, 
  ProcessProgrammesResponse 
} from "../types/shared-types";

export default function SelectProgrammesPage() {
  // STORES
  const {
    primaryMajor,
    secondaryMajor,
    minors,
    getAllSelectedIds, // Changed from getAllSelected
    isDuplicate,
    resetAll,
    fetchProgrammes, // New method to fetch programmes
    isLoading: storeLoading, // Renamed to avoid conflict
    error: storeError, // Renamed to avoid conflict
  } = useMajorStore();

  const {
    showSecondarySelect,
    setShowSecondarySelect,
    errorMessage,
    setErrorMessage,
  } = useUIStore();

  /* LOCAL STATE */
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  /* Fetch programmes from Supabase*/
  useEffect(() => {
    fetchProgrammes();
  }, [fetchProgrammes]);

  /* EVENT HANDLERS */
  const handleGenerateCourses = async () => {
    // Basic validation
    const selectedIds = getAllSelectedIds();

    for (const m of selectedIds) {
      if (isDuplicate(m)) {
        setErrorMessage('You cannot choose the same major more than once.');
        return;
      }
    }
    if (!primaryMajor) {
      setErrorMessage('Please select a primary major.');
      return;
    }
    if (showSecondarySelect && !secondaryMajor) {
      setErrorMessage('You have not selected your secondary major.');
      return;
    }
    if (minors.some((m) => !m?.name?.trim())) {
      setErrorMessage('You have not selected your minor.');
      return;
    }

    // Build request body
    const programmeIds = selectedIds;

    // Fetch backend
    try {
      setLoading(true);
      const req: ProcessProgrammesRequest = { programmeIds }; // to account for userId in the future
      const res: BackendResponse<ProcessProgrammesResponse> = await generateAP(req);

      const payloads: ProgrammePayload[] = res.data.programmes;

      // console.log("ProcessProgrammesResponse:", res);
      // console.log("Backend payloads:", payloads);
      //exportJson(payloads, 'payloads.json'); // DEBUG

      if (!payloads.length) {
        setErrorMessage('Backend returned no payload.');
        return;
      }

      // Load global planner store
      // usePlannerStore.getState().loadProgrammes(payloads, lookups, fe2beList);
      setLoaded(true);
    } catch (err: any) {
      console.error(err);
      const errorMessage = beErrorHandler.getErrorMessage(err as beError);
      setErrorMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setLoaded(false);
    resetAll();
    setShowSecondarySelect(false);
  };

  /* RENDER */
  // Planner page
  if (loaded) {
    return <PlannerPage onBack={handleBack} />;
  }

  // Choose Major page
  return (
    <Box p={4} maxWidth={650} mx="auto">
      <Typography variant="h4" gutterBottom>
        NUSPlan
      </Typography>

      {/* Information banner */}
      <Alert severity="info">
        Please take note of the following restrictions:<br />
        Possible choices for Primary Major: Life Sciences, Computer Science, Business Analytics.<br />
        Possible choices for Secondary Major: Life Sciences only.<br />
        Possible choices for Minors: Life Sciences, Bioinformatics<br />
      </Alert>


      {/* Selectors */}
      <InputPrimaryMajor />
      <InputSecondaryMajor />
      <InputMinor />

      {/* Buttons */}
      <Box display="flex" gap={2} mt={2}>
        <AddSecondary />
        <AddMinor />
        <Button variant="contained" onClick={handleGenerateCourses} disabled={loading}>
          Generate Courses
        </Button>
        <Button
          variant="text"
          onClick={() => {
            resetAll();
            setShowSecondarySelect(false);
          }}
        >
          Reset All
        </Button>
      </Box>

      {/* Spinner */}
      {loading && (
        <Box mt={4} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      )}

      {/* Error toast and Alert for programme combination issues */}
      {errorMessage && errorMessage.includes('Invalid Programme Combination') ? (
        <Alert 
          severity="warning" 
          sx={{ mt: 2 }}
          onClose={() => setErrorMessage("")}
        >
          {errorMessage}
        </Alert>
      ) : (
        <Snackbar
          open={!!errorMessage}
          autoHideDuration={6000}
          onClose={() => setErrorMessage("")}
          message={errorMessage}
        />
      )}
    </Box>
  );
}