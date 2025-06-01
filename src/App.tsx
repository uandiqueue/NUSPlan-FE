import { Box, Typography, Button, Snackbar } from "@mui/material";
import { useMajorStore } from "./store/useMajorStore";
import { useUIStore } from "./store/useUIStore";
import InputPrimaryMajor from "./components/InputPrimaryMajor";
import InputSecondaryMajor from "./components/InputSecondaryMajor";
import InputMinor from "./components/InputMinor";
import AddSecondary from "./components/AddSecondary";
import AddMinor from "./components/AddMinor";

export default function App() {
  const { primaryMajor, secondaryMajor, minors, addMinor, resetAll } =
    useMajorStore();

  const {
    showSecondarySelect,
    setShowSecondarySelect,
    errorMessage,
    setErrorMessage,
  } = useUIStore();

  const handleExplore = () => {
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
    console.log({ primaryMajor, secondaryMajor, minors });
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
