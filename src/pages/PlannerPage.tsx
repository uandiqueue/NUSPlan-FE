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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { RequirementBlock } from '../components/requirementBlock';
import { ProgressGraph }    from '../components/progressGraph';
import { usePlanner }       from '../hooks/usePlanner';

export interface PlannerPageProps {
  onBack: () => void;
}

export default function PlannerPage({ onBack }: PlannerPageProps) {
  // Context via usePlanner hook
  const ctx = usePlanner();            // returns PlannerContextValue
  const theme = useTheme();
  const upLg  = useMediaQuery(theme.breakpoints.up('lg'));
  const [hideWarn, setHideWarn] = useState(false);

  // Provider not mounted yet
  if (!ctx) {
    return (
      <Box p={4}>
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  const { payload, warnings } = ctx;

  return (
    <Box p={4}>
      {/* ← Back button */}
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

      {/* Main grid layout */}
      <Box
        display="grid"
        gap={4}
        gridTemplateColumns={upLg ? '2fr 1fr' : '1fr'}
      >
        {/* Requirement sections */}
        <Box>
          {payload.requirements.map(sec => (
            <RequirementBlock key={sec.requirementKey} block={sec} />
          ))}
        </Box>

        {/* Progress sidebar */}
        <Box position="sticky" top={16}>
          <Typography variant="h6" gutterBottom>
            Progress
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <ProgressGraph />
        </Box>
      </Box>
    </Box>
  );
}
