import { Box, Typography, Button, Snackbar } from "@mui/material";
import { useMajorStore } from "./store/useMajorStore";
import { useUIStore } from "./store/useUIStore";
import InputPrimaryMajor from "./components/InputPrimaryMajor";
import InputSecondaryMajor from "./components/InputSecondaryMajor";
import InputMinor from "./components/InputMinor";
import AddSecondary from "./components/AddSecondary";
import AddMinor from "./components/AddMinor";

import { populateModules } from "./api/populate";
import type { Programme } from "./types/populator";


export default function App() {
  const { primaryMajor, secondaryMajor, minors, addMinor, resetAll } =
    useMajorStore();

  const {
    showSecondarySelect,
    setShowSecondarySelect,
    errorMessage,
    setErrorMessage,
  } = useUIStore();

  const handleExplore = async () => {
    if (!primaryMajor) {
      setErrorMessage("Please select a primary major.");
      return;
    }
    if (showSecondarySelect && !secondaryMajor) {
      setErrorMessage("You have not selected your secondary major.");
      return;
    }

    if (minors.some((m) => !m.value || m.value.trim() === "")) {
      setErrorMessage("You have not selected your minor.");
      return;
    }

    // Prepare the payload for the API
    const programmes: Programme[] = [];
    if (primaryMajor) {
      programmes.push({ name: primaryMajor, type: "major" });
    }
    if (secondaryMajor) {
      programmes.push({ name: secondaryMajor, type: "secondMajor" });
    }
    for (const minor of minors) {
      if (minor) {
        programmes.push({ name: minor.value, type: "minor" });
      }
    }

    // Sending the payload to the backend
    const result = await populateModules(programmes);
    // result is now typed as PopulatedProgramPayload[]
    console.log(result);
  };

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom>
        NUSPlan
      </Typography>

      <InputPrimaryMajor />

      <InputSecondaryMajor />

      <InputMinor />

      <Box display="flex" gap={2} mt={2}>
        <AddSecondary />
        <AddMinor />
        <Button variant="contained" onClick={handleExplore}>
          Explore
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

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={3000}
        onClose={() => setErrorMessage("")}
        message={errorMessage}
      />
    </Box>
  );
}
