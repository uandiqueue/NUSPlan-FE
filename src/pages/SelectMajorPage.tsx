import { useState } from "react";
import { Box, Typography, Button, Snackbar, CircularProgress, Alert } from "@mui/material";
import { useMajorStore } from "../store/useMajorStore";
import { useUIStore } from "../store/useUIStore";
import InputPrimaryMajor from "../components/InputPrimaryMajor";
import InputSecondaryMajor from "../components/InputSecondaryMajor";
import InputMinor from "../components/InputMinor";
import AddSecondary from "../components/AddSecondary";
import AddMinor from "../components/AddMinor";
import { populateModules } from "../api/populate";
// import type { Programme, PopulatedProgramPayload } from "../types/shared/populator";
import PlannerPage from "./PlannerPage";
import { usePlannerStore } from "../store/usePlannerStore";
import type { LookupTable } from "../types/feValidator";
import { normalisePayload } from "../services/validator/normalise";
import { exportJson } from "../services/tester";
import { supabase } from "../App";
import { BackendResponse, ProgrammePayload, ProcessProgrammesRequest, ProcessProgrammesResponse } from "../types/shared-types";

function buildFEtoBEMap(lookup: LookupTable): Record<string, string> {
  const map: Record<string, string> = {};
  for (const beKey in lookup.modulesByRequirement) {
    const parts = beKey.split(':');
    const feKey = parts[parts.length - 1];
    map[feKey] = beKey;
  }
  return map;
}

export default function SelectMajorPage() {
  // STORES
  const {
    primaryMajor,
    secondaryMajor,
    minors,
    getAllSelected,
    isDuplicate,
    resetAll,
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

  /* Fetch the ProgrammeId based on the major and type from supabase*/
  interface ProgrammeIdResponse {
    id: string;
  }

  const fetchProgrammeId = async (major: string, majorType: string): Promise<ProgrammeIdResponse> => {
    let { data, error } = await supabase
      .from('programmes')
      .select('id')
      .eq("name", major)
      .eq("type", majorType)
      .single()

    if (error || !data) {
      throw new Error(`Unable to find programme id for ${major}: ${majorType}`);
    }

    return data;
  }

  /* EVENT HANDLERS */
  const handleGenerateCourses = async () => {
    // Basic validation
    const selected = getAllSelected();
    for (const m of selected) {
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
    if (minors.some((m) => !m?.trim())) {
      setErrorMessage('You have not selected your minor.');
      return;
    }

    // Build request body
    const programmeIds: string[] = [];

    const primary = await fetchProgrammeId(primaryMajor, "major");
    programmeIds.push(primary.id);

    if (secondaryMajor) {
      const secondary = await fetchProgrammeId(secondaryMajor, "secondMajor");
      programmeIds.push(secondary.id);
    }

    for (const minor of minors) {
      const m = await fetchProgrammeId(minor, "minor");
      programmeIds.push(m.id);
    }

    // Fetch backend
    try {
      setLoading(true);
      const req: ProcessProgrammesRequest = { programmeIds }; // to account for userId in the future
      const res: BackendResponse<ProcessProgrammesResponse> = await populateModules(req);

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
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to fetch modules from backend.');
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

      {/* Error toast */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={3000}
        onClose={() => setErrorMessage("")}
        message={errorMessage}
      />
    </Box>
  );
}