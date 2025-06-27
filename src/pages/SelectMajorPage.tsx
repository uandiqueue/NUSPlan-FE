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
import type { PopulatedProgramPayload, Programme } from "../types/shared/populator";
import { PlannerProvider } from "../context/payloadContext";
import PlannerPage from "./PlannerPage";

function SelectMajorPage() {
    const { primaryMajor, secondaryMajor, minors, getAllSelected, isDuplicate, resetAll } =
        useMajorStore();
    const {
        showSecondarySelect,
        setShowSecondarySelect,
        errorMessage,
        setErrorMessage,
    } = useUIStore();

    const [payload, setPayload] = useState<PopulatedProgramPayload[] | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGenerateCourses = async () => {
        const selectedMajors = getAllSelected();
        for (const major of selectedMajors) {
            if (isDuplicate(major)) {
                setErrorMessage("You cannot choose the same major more than once.");
                return;
            }
        }

        if (!primaryMajor) {
            setErrorMessage("Please select a primary major.");
            return;
        }
        if (showSecondarySelect && !secondaryMajor) {
            setErrorMessage("You have not selected your secondary major.");
            return;
        }
        if (minors.some((minor) => !minor?.trim())) {
            setErrorMessage("You have not selected your minor.");
            return;
        }

        const programmes: Programme[] = [];
        programmes.push({ name: primaryMajor, type: "major" });
        if (secondaryMajor) programmes.push({ name: secondaryMajor, type: "secondMajor" });
        minors.forEach((minor) =>
            programmes.push({ name: minor, type: "minor" })
        );

        // Backend fetch
        try {
            setLoading(true);
            const payloads = await populateModules(programmes); // expect full objects
            if (payloads && payloads.length) {
                setPayload(payloads); // full PopulatedProgramPayload
            } else {
                setErrorMessage("Backend returned no payload.");
            }
        } catch {
            setErrorMessage("Failed to fetch modules from backend.");
        } finally {
            setLoading(false);
        }
    };

    // Planner page
    if (payload) {
        return (
            <PlannerProvider initialPayloads={payload}>
                <PlannerPage
                    onBack={() => {
                        setPayload(null);
                        resetAll();
                        setShowSecondarySelect(false);
                    }}
                />
            </PlannerProvider>
        );
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

export default SelectMajorPage;