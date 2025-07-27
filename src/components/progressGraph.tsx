import React, { useState, useEffect } from 'react';
import { CircularProgress, Box, Typography, LinearProgress } from '@mui/material';
import { usePlannerStore } from '../store/usePlannerStore';

interface ProgressSummary {
  requiredUnits: number;
  fulfilledUnits: number;
}

export default function ProgressGraph() {
  const { programme, getProgressSummary } = usePlannerStore();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProgressSummary(programme.programmeId)
      .then((data: any) => {
        if (cancelled) return;
        // To change to match response
        setSummary({
          requiredUnits: data.requiredUnits ?? data.required ?? 0,
          fulfilledUnits: data.fulfilledUnits ?? data.fulfilled ?? 0,
        });
      })
      .catch((e: any) => {
        console.error('Error fetching progress summary:', e);
        if (!cancelled) setError('Failed to load progress');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programme.programmeId, getProgressSummary]);

  if (loading) {
    return (
      <Box my={2}>
        <LinearProgress />
      </Box>
    );
  }

  if (error || !summary) {
    return <Typography color="error">{error || 'No progress data available'}</Typography>;
  }

  const { requiredUnits, fulfilledUnits } = summary;
  const percent = requiredUnits === 0 ? 0 : Math.round((fulfilledUnits / requiredUnits) * 100);

  return (
    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
      <CircularProgress variant="determinate" value={percent} size={120} thickness={5} />
      <Box
        top={0}
        left={0}
        bottom={0}
        right={0}
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography variant="h6" component="div">
          {percent}%
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {fulfilledUnits}/{requiredUnits} MC fulfilled
      </Typography>
    </Box>
  );
}
