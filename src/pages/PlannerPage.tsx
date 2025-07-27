'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Tab,
  LinearProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { RequirementBlock } from '../components/requirementBlock';
import ProgressGraph from '../components/progressGraph';
import { usePlannerStore } from '../store/usePlannerStore';
import type { ModuleCode } from '../types/nusmods-types';

import { dbService } from '../services/dbQuery';

export interface PlannerPageProps {
  onBack: () => void; // To go back to the major selection page
}

export default function PlannerPage({ onBack }: PlannerPageProps) {
  const {
    programmes,
    programme,
    selectedProgramIndex,
    switchProgramme,
    warnings,
  } = usePlannerStore();

  const theme = useTheme();
  const upLg = useMediaQuery(theme.breakpoints.up('lg'));


  // Local UI state
  const [hideWarn, setHideWarn] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadError, setPreloadError] = useState<string | null>(null);
  const didWarmCacheRef = useRef(false);

  // Re-show the warning banner whenever warnings change
  useEffect(() => {
    if (warnings.length > 0) setHideWarn(false);
  }, [warnings]);

  // Collect ALL module codes across all selected payloads (unique)
  const allModuleCodes: ModuleCode[] = useMemo(() => {
    const set = new Set<ModuleCode>();
    for (const p of programmes ?? []) {
      const map = (p as any)?.moduleToPathMap ?? {};
      for (const code of Object.keys(map)) set.add(code as ModuleCode);
    }
    return Array.from(set);
  }, [programmes]);

  // Warm caches once when payloads arrive
  useEffect(() => {
    if (!programmes.length || didWarmCacheRef.current) return;

    // Only warm if we actually have module codes
    if (allModuleCodes.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        setIsPreloading(true);
        setPreloadError(null);
        // Warm all three caches (modules, prerequisites, preclusions)
        await dbService.getModulesDetails(allModuleCodes);
        if (!cancelled) didWarmCacheRef.current = true;
      } catch (err: any) {
        if (!cancelled) {
          console.error('Cache preload failed:', err);
          setPreloadError('Preloading module data failed. You can still proceed; data will load on demand.');
        }
      } finally {
        if (!cancelled) setIsPreloading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [programmes, allModuleCodes]);

  // Provider not mounted yet / still loading backend payload
  if (!programmes.length || !programme) {
    return (
      <Box p={4}>
        <Typography>Loading…</Typography>
        <LinearProgress sx={{ mt: 2, maxWidth: 360 }} />
      </Box>
    );
  }

  return (
    <Box p={4}>
      {/* Back button to major selection page */}
      <Button variant="text" size="small" onClick={onBack} sx={{ mb: 2 }}>
        ← Back to programme selection
      </Button>

      {/* Optional preload status */}
      {isPreloading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Warming caches (modules, prerequisites, preclusions)… This runs once and speeds up lookups.
        </Alert>
      )}
      {preloadError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {preloadError}
        </Alert>
      )}

      {/* Warning banner from validator/logic */}
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
      <Tabs
        value={selectedProgramIndex}
        onChange={(_, value) => switchProgramme(value)}
        sx={{ mb: 2 }}
      >
        {programmes.map((program, index) => (
          <Tab
            key={index}
            label={program.metadata.name}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>

      {/* Main grid layout: left = program requirements, right = progress */}
      <Box display="grid" gap={4} gridTemplateColumns={upLg ? '2fr 1fr' : '1fr'}>
        {/* Requirement sections */}
        <Box
          border="1px solid #ccc"
          borderRadius={2}
          p={3}
          sx={{
            maxHeight: upLg ? 'calc(100vh - 150px)' : 'none',
            overflowY: upLg ? 'auto' : 'visible',
          }}
        >
          {programme.sections.map((sec: any) => (
            <RequirementBlock key={sec.requirementKey} block={sec} programmeId={programme.programmeId}/>
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
