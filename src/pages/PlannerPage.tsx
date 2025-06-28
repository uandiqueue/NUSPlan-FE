'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  Alert,
  IconButton,
  Tabs,
  Tab
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { RequirementBlock } from '../components/requirementBlock';
import ProgressGraph from '../components/progressGraph';
import { usePlanner } from '../store/usePlanner';

export interface PlannerPageProps {
  onBack: () => void; // To go back to the major selection page
}

export default function PlannerPage({ onBack }: PlannerPageProps) {
  const {
    payloads,
    payload,
    selectedProgramIndex,
    switchProgramme,
    warnings
  } = usePlanner();
  const theme = useTheme();
  const upLg = useMediaQuery(theme.breakpoints.up('lg'));
  const [hideWarn, setHideWarn] = useState(false); // control hiding warning banner

  // Provider not mounted yet
  if (!payloads.length) {
    return (
      <Box p={4}>
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box p={4}>
      {/* ← Back button to major selection page*/}
      <Button variant="text" size="small" onClick={onBack} sx={{ mb: 2 }}>
        ← Back to programme selection
      </Button>

      {/* Warning banner */}
      {!hideWarn && warnings.length > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <IconButton size="small" onClick={() => setHideWarn(true)}>
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      )}

      {/* Tabs for each selected program */}
      <Tabs value={selectedProgramIndex} onChange={(_, value) => switchProgramme(value)} sx={{ mb: 2 }}>
        {payloads.map((program, index) => (
          <Tab key={index} label={program.metadata.name} sx={{ textTransform: 'none', fontWeight: 600 }} />
        ))}
      </Tabs>

      {/* Main grid layout: left = program requirements, right = progress */}
      <Box
        display="grid"
        gap={4}
        gridTemplateColumns={upLg ? '2fr 1fr' : '1fr'}
      >
        {/* Requirement sections */}
        <Box border="1px solid #ccc" borderRadius={2} p={3}>
          {payload.requirements.map(sec => (
            <RequirementBlock key={sec.requirementKey} block={sec} />
          ))}
        </Box>

        {/* Progress sidebar */}
        <Box position="sticky" top={16}>
          <Typography variant="h6" gutterBottom>
            Overall Progress
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <ProgressGraph /> 
        </Box>
      </Box>
    </Box>
  );
}
