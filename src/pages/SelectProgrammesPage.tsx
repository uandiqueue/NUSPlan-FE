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
import PlannerPage from "./PlannerPage";
import { usePlannerStore } from "../store/usePlannerStore";
import { beError, beErrorHandler } from "../services/errorHandler/be-error";
import { FEDatabaseQueryService } from "../services/dbQuery";
import {
  BackendResponse,
  ProgrammePayload,
  ProcessProgrammesRequest,
  ProcessProgrammesResponse
} from "../types/shared-types";
import { Programme } from "../types/frontend-types";
import Header from "../components/Header";

export default function SelectProgrammesPage() {
  // STORES
  const {
    primaryMajor,
    secondaryMajor,
    minors,
    getAllSelectedIds,
    isDuplicate,
    resetAll,
    fetchProgrammes,
    isLoading: storeLoading,
    error: storeError,
    availableMajors,
    availableSecondMajors,
    availableMinors,
  } = useMajorStore();

  const {
    showSecondarySelect,
    setShowSecondarySelect,
    errorMessage,
    setErrorMessage,
  } = useUIStore();

  const { loadProgrammes } = usePlannerStore();
  const dbService = FEDatabaseQueryService.getInstance();

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

    // Initialize local cache (Phase 1 without lookup)
    await dbService.initializeCache(programmeIds);

    // Fetch backend
    try {
      setLoading(true);
      const req: ProcessProgrammesRequest = { programmeIds }; // to account for userId in the future
      const res: BackendResponse<ProcessProgrammesResponse> = await generateAP(req);
      const globalLookup = res.data.lookup;
      const programmes: ProgrammePayload[] = res.data.programmes.map(p => ({
        ...p,
        lookupMaps: globalLookup
      }));

      console.log("ProcessProgrammesResponse:", res); // FOR DEBUGGING PURPOSES
      console.log("Backend payloads:", programmes); // FOR DEBUGGING PURPOSES
      //exportJson(payloads, 'payloads.json'); // DEBUG


      if (programmes.length > 0) {
        programmes[0].sections.push({
          groupType: 'unrestrictedElectives',
          displayLabel: 'Unrestricted Electives',
          paths: [],
          courseBoxes: [], // Starts empty
          hidden: [],
        });
      }

      if (!programmes.length) {
        setErrorMessage('Backend returned no payload.');
        return;
      }

      // Load global planner store
      loadProgrammes(programmes, res.data.lookup);
      setLoaded(true);

      // Finish caching (Phase 2 with lookup)
      dbService
        .initializeCache(programmeIds, res.data.lookup)
        .catch((error) => console.error('Cache phase 2 failed', error));

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

  // Helper function to display the major restrictions in the alert banner
  const formatNames = (list: Programme[]) => {
    return list.length ? list.map(p => p.name).join(", ") : "None available";
  }

  /* RENDER */
  // Planner page
  if (loaded) {
    return <PlannerPage onBack={handleBack} />;
  }

  // Choose Major page
  return (
    <>
      <Header />

      <Box p={4} maxWidth={650} mx="auto">

        {/* Information banner */}
        <Alert severity="info" sx={{ mb: 3 }}>
          Sign in to save your data.<br />
          Please take note of the following restrictions:<br />
          Possible choices for Primary Major: {formatNames(availableMajors)}.<br />
          Possible choices for Secondary Major: {formatNames(availableSecondMajors)}.<br />
          Possible choices for Minors: {formatNames(availableMinors)}<br />
        </Alert>


        {/* Selectors */}
        <InputPrimaryMajor />
        <InputSecondaryMajor />
        <InputMinor />

        {/* Buttons */}
        <Box display="flex" gap={2} mt={3}>
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
    </>
  );
}