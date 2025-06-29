import { useState } from "react";
import { Box, Typography, Button, Snackbar, CircularProgress } from "@mui/material";
import { useMajorStore } from "../store/useMajorStore";
import { useUIStore } from "../store/useUIStore";
import InputPrimaryMajor from "../components/InputPrimaryMajor";
import InputSecondaryMajor from "../components/InputSecondaryMajor";
import InputMinor from "../components/InputMinor";
import AddSecondary from "../components/AddSecondary";
import AddMinor from "../components/AddMinor";
import { populateModules } from "../api/populate";
import type { Programme, PopulatedProgramPayload } from "../types/shared/populator";
import PlannerPage from "./PlannerPage";
import { usePlanner } from "../store/usePlanner";
import type { LookupTable } from "../types/feValidator";
import { normalisePayload } from "../services/validator/normalise";
import { exportJson } from "../services/tester";

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
  const [loaded,  setLoaded]  = useState(false);
  const [loading, setLoading] = useState(false);

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
    const programmes: Programme[] = [];
    programmes.push({ name: primaryMajor,  type: 'major' });
    if (secondaryMajor)
      programmes.push({ name: secondaryMajor, type: 'secondMajor' });
    minors.forEach((mn) => programmes.push({ name: mn, type: 'minor' }));

    // Fetch backend
    try {
      setLoading(true);
      const payloads: PopulatedProgramPayload[] = await populateModules(programmes);

      if (!payloads.length) {
        setErrorMessage('Backend returned no payload.');
        return;
      }

      // Transform lookups & maps
      const lookups: LookupTable[] = payloads.map(normalisePayload);
      //exportJson(lookups, 'lookups.json'); // DEBUG
      const fe2beList: Record<string, string>[] = lookups.map(buildFEtoBEMap);

      // Load global planner store
      usePlanner.getState().loadProgrammes(payloads, lookups, fe2beList);
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
        <Box p={4} maxWidth={580}>
            <Typography variant="h4" gutterBottom>
                NUSPlan
            </Typography>

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