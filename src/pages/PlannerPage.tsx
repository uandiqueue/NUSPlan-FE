import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Box, Button, Typography, Divider,
  useTheme, useMediaQuery,
  Tabs, Tab, LinearProgress, CircularProgress, Alert, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { RequirementBlock } from '../components/requirementBlock';
import ProgressGraph from '../components/progressGraph';
import { usePlannerStore } from '../store/usePlannerStore';
import type { ModuleCode } from '../types/nusmods-types';
import { dbService } from '../services/dbQuery';
import { supabase } from '../config/supabase';
import type { User } from '@supabase/supabase-js';

export interface PlannerPageProps { onBack: () => void; }

export default function PlannerPage({ onBack }: PlannerPageProps) {
  const {
    programmes,
    programme,
    selectedProgramIndex,
    switchProgramme,
    loadUserPlannerData,
    saveUserPlannerData,
    warnings
  } = usePlannerStore();

  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadError, setPreloadError] = useState<string | null>(null);
  const [hideWarn, setHideWarn] = useState(false); // control hiding warning banner

  // makes the warning banner appear again whenever the warnings change
  useEffect(() => {
    if (warnings.length > 0) {
      setHideWarn(false);
    }
  }, [warnings]);

  const theme = useTheme();
  const upLg = useMediaQuery(theme.breakpoints.up('lg'));
  const didWarmCacheRef = useRef(false);

  const allModuleCodes: ModuleCode[] = useMemo(() => {
    const set = new Set<ModuleCode>();
    for (const p of programmes) {
      const map = (p as any)?.moduleToPathMap ?? {};
      for (const code of Object.keys(map)) set.add(code as ModuleCode);
    }
    return Array.from(set);
  }, [programmes]);

  useEffect(() => {
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      if (data?.user) {
        loadUserPlannerData(data.user.id);
      }
    }
    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserPlannerData(session.user.id);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadUserPlannerData]);

  useEffect(() => {
    if (!programmes.length || didWarmCacheRef.current) return;
    if (!allModuleCodes.length) return;

    let cancelled = false;
    (async () => {
      setIsPreloading(true);
      setPreloadError(null);
      try {
        await dbService.getModulesDetails(allModuleCodes);
        if (!cancelled) didWarmCacheRef.current = true;
      } catch {
        if (!cancelled) setPreloadError('Preloading module data failed.');
      } finally {
        if (!cancelled) setIsPreloading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [programmes, allModuleCodes]);

  if (!programme || !programme.sections) {
    return (
      <Box p={4}>
        <Typography>Loading…</Typography>
        <LinearProgress sx={{ mt: 2, maxWidth: 360 }} />
      </Box>
    );
  }

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveUserPlannerData(user.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box p={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Button variant="text" size="small" onClick={onBack}>
          Back to programme selection
        </Button>
        <Button
          variant="contained"
          disabled={!user || saving}
          onClick={handleSave}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? 'Saving…' : 'Save Data'}
        </Button>
      </Box>

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

      {/* Tabs for each selected programme */}
      <Tabs
        value={selectedProgramIndex}
        onChange={(_, v) => switchProgramme(v)}
        sx={{ mb: 2 }}
      >
        {programmes.map((prog, i) => (
          <Tab
            key={i}
            label={prog.metadata.name}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>

      {/* Main grid layout */}
      <Box display="grid" gap={4} gridTemplateColumns={upLg ? '2fr 1fr' : '1fr'}>
        <Box
          border="1px solid #ccc"
          borderRadius={2}
          p={3}
          sx={{
            maxHeight: upLg ? 'calc(100vh - 150px)' : 'none',
            overflowY: upLg ? 'auto' : 'visible',
          }}
        >
          {programme.sections.map(sec => (
            <RequirementBlock
              key={sec.groupType}
              block={sec}
              programmeId={programme.programmeId}
            />
          ))}
        </Box>

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
