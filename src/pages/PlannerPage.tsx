import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Box, Button, Typography, Divider, useTheme, useMediaQuery, Tabs, Tab, LinearProgress,
} from '@mui/material';
import { RequirementBlock } from '../components/requirementBlock';
import ProgressGraph from '../components/progressGraph';
import { usePlannerStore } from '../store/usePlannerStore';
import type { ModuleCode } from '../types/nusmods-types';
import { CourseBox, RequirementGroupType, ProgrammeSection } from '../types/shared-types';
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
    userAddedBoxes,
    loadUserPlannerData,
    saveUserPlannerData,
  } = usePlannerStore();

  const [user, setUser] = useState<User | null>(null);
  const theme = useTheme();
  const upLg = useMediaQuery(theme.breakpoints.up('lg'));
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadError, setPreloadError] = useState<string | null>(null);
  const didWarmCacheRef = useRef(false);

  const allModuleCodes: ModuleCode[] = useMemo(() => {
    const set = new Set<ModuleCode>();
    for (const p of programmes ?? []) {
      const map = (p as any)?.moduleToPathMap ?? {};
      for (const code of Object.keys(map)) set.add(code as ModuleCode);
    }
    return Array.from(set);
  }, [programmes]);

  useEffect(() => {
    if (!programmes.length || didWarmCacheRef.current) return;
    if (allModuleCodes.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        setIsPreloading(true);
        setPreloadError(null);
        await dbService.getModulesDetails(allModuleCodes);
        if (!cancelled) didWarmCacheRef.current = true;
      } catch (err: any) {
        if (!cancelled) setPreloadError('Preloading module data failed.');
      } finally {
        if (!cancelled) setIsPreloading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [programmes, allModuleCodes]);

  useEffect(() => {
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);

      // 2. If user exists, load their planner data from Supabase
      if (data?.user) {
        loadUserPlannerData(data.user.id);
      }
    }
    fetchUser();

    // Listen to login/logout events
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        loadUserPlannerData(session.user.id);
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [loadUserPlannerData]);

  function getVisibleBoxes(sec: ProgrammeSection): CourseBox[] {
    const payloadBoxes = sec.courseBoxes;
    const addedBoxes = userAddedBoxes
      .filter(b =>
        b.programmeId === programme.programmeId &&
        b.groupType === sec.groupType
      )
      .map(b => b.box);
    return [...payloadBoxes, ...addedBoxes];
  }

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
      <Button variant="text" size="small" onClick={onBack} sx={{ mb: 2 }}>
        ← Back to programme selection
      </Button>
      <Button
        disabled={!user}
        onClick={() => user && saveUserPlannerData(user.id)}
      >
        Save Data
      </Button>
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

      <Box display="grid" gap={4} gridTemplateColumns={upLg ? '2fr 1fr' : '1fr'}>
        <Box border="1px solid #ccc" borderRadius={2} p={3}
          sx={{
            maxHeight: upLg ? 'calc(100vh - 150px)' : 'none',
            overflowY: upLg ? 'auto' : 'visible',
          }}>
          {programme.sections.map((sec) => {
            const visibleBoxes = getVisibleBoxes(sec);
            return (
              <RequirementBlock
                key={sec.groupType}
                block={{ ...sec, courseBoxes: visibleBoxes }}
                programmeId={programme.programmeId}
              />
            );
          })}
        </Box>
        <Box position="sticky" top={16}>
          <Typography variant="h6" gutterBottom>Overall Progress</Typography>
          <Divider sx={{ mb: 2 }} />
          <ProgressGraph />
        </Box>
      </Box>
    </Box>
  );
}
