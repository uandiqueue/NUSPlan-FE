import { useState } from "react";
import { Box, Typography, Button, Snackbar, CircularProgress } from "@mui/material";
import { useMajorStore } from "./store/useMajorStore";
import { useUIStore } from "./store/useUIStore";
import InputPrimaryMajor from "./components/InputPrimaryMajor";
import InputSecondaryMajor from "./components/InputSecondaryMajor";
import InputMinor from "./components/InputMinor";
import AddSecondary from "./components/AddSecondary";
import AddMinor from "./components/AddMinor";
import { populateModules, Programme } from "./api/populate";
import type { PopulatedPayload } from "./app/types/payload";
import { PayloadProvider } from "./app/context/payloadContext";
import PlannerPage from "./pages/PlannerPage";

export default function App() {
  const { primaryMajor, secondaryMajor, minors, addMinor, resetAll } =
    useMajorStore();
  const {
    showSecondarySelect,
    setShowSecondarySelect,
    errorMessage,
    setErrorMessage,
  } = useUIStore();

  const [payload, setPayload] = useState<PopulatedPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const handleExplore = async () => {
    if (!primaryMajor) {
      setErrorMessage("Please select a primary major.");
      return;
    }
    if (showSecondarySelect && !secondaryMajor) {
      setErrorMessage("You have not selected your secondary major.");
      return;
    }
    if (minors.some((m) => !m.value?.trim())) {
      setErrorMessage("You have not selected your minor.");
      return;
    }

    const programmes: Programme[] = [];
    programmes.push({ name: primaryMajor, type: "major" });
    if (secondaryMajor) programmes.push({ name: secondaryMajor, type: "secondMajor" });
    minors.forEach((m) =>
      programmes.push({ name: m.value, type: "minor" })
    );

    try {
      setLoading(true);
      console.log(programmes);
      const res = await populateModules(programmes);
      const inner = res[0]?.populatedPayload;
      if (inner) setPayload(inner);
      else setErrorMessage("Backend returned no payload.");

    } catch (err) {
      setErrorMessage("Failed to fetch modules from backend.");
    } finally {
      setLoading(false);
    }
  };

  if (payload) {
    return (
      <PayloadProvider initialPayload={payload}>
        <PlannerPage
          onBack={() => {
            setPayload(null);
            resetAll();
            setShowSecondarySelect(false);
          }}
        />
      </PayloadProvider>
    );
  }

  return (
    <Box p={4} maxWidth={580}>
      <Typography variant="h4" gutterBottom>
        NUSPlan
      </Typography>

      {/* programme selectors */}
      <InputPrimaryMajor />
      <InputSecondaryMajor />
      <InputMinor />

      {/* action buttons */}
      <Box display="flex" gap={2} mt={2}>
        <AddSecondary />
        <AddMinor />
        <Button variant="contained" onClick={handleExplore} disabled={loading}>
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

      {/* loading spinner */}
      {loading && (
        <Box mt={4} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      )}

      {/* toast-style error message */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={3000}
        onClose={() => setErrorMessage("")}
        message={errorMessage}
      />
    </Box>
  );
}
