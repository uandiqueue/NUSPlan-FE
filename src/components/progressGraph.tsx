import React, { useState, useEffect } from 'react';
import { CircularProgress, Box, Typography, LinearProgress } from '@mui/material';
import { usePlannerStore } from '../store/usePlannerStore';

interface ProgressSummary {
  requiredUnits: number;
  fulfilledUnits: number;
}

export default function ProgressGraph() {
  const { programme, getProgressSummary, progressVersion } = usePlannerStore();
  const [summary, setSummary] = useState<ProgressSummary>({ requiredUnits: 0, fulfilledUnits: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProgressSummary(programme.programmeId)
      .then((data: any) => {
        if (!active) return;
        // handle different possible shapes
        const total = data.totalProgress?.required 
          ?? data.requiredUnits 
          ?? data.required 
          ?? 0;
        const fulfilled = data.totalProgress?.fulfilled 
          ?? data.fulfilledUnits 
          ?? data.fulfilled 
          ?? 0;
        setSummary({ requiredUnits: total, fulfilledUnits: fulfilled });
      })
      .catch((e: any) => {
        console.error('Error fetching progress summary:', e);
        if (active) setError('Failed to load progress');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [programme.programmeId, getProgressSummary, progressVersion]);

  if (loading) {
    return (
      <Box sx={{ width: '100%', my: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  const { requiredUnits, fulfilledUnits } = summary;
  const percent = requiredUnits === 0
    ? 0
    : Math.round((fulfilledUnits / requiredUnits) * 100);

  return (
    <Box
      sx={{
        width: 140,
        height: 140,
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress
        variant="determinate"
        value={percent}
        size={120}
        thickness={5}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6" component="div">
          {percent}%
        </Typography>
      </Box>
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2">
        {fulfilledUnits}/{requiredUnits} MC fulfilled
      </Typography>
    </Box>
    </Box>
  );
}
