/*
import { useState } from "react";
import { Box, Typography, Button, Snackbar, CircularProgress } from "@mui/material";
import { useMajorStore } from "./store/useMajorStore";
import { useUIStore } from "./store/useUIStore";
import InputPrimaryMajor from "./components/InputPrimaryMajor";
import InputSecondaryMajor from "./components/InputSecondaryMajor";
import InputMinor from "./components/InputMinor";
import AddSecondary from "./components/AddSecondary";
import AddMinor from "./components/AddMinor";
import { populateModules } from "./api/populate";
import type { PopulatedProgramPayload, Programme } from "./types/shared/populator";
import { PlannerProvider } from "./context/payloadContext";
import PlannerPage from "./pages/PlannerPage";
 */
import MajorPage from "./pages/SelectMajorPage"

export default function App() {
  return <MajorPage />
}
