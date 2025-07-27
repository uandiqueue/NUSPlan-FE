import React, { useState, useEffect, useCallback } from 'react';
import type { ModuleCode } from '../types/nusmods-types';
import type { CourseBox, PathInfo } from '../types/shared-types';
import type { ModuleTag, PendingDecision } from '../types/frontend-types';
import { usePlannerStore } from '../store/usePlannerStore';
import { dbService } from '../services/dbQuery';
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Button,
  Stack
} from '@mui/material';
import BoxRenderer from './BoxRenderer';

interface ModuleOption {
  module: ModuleCode;
  isDisabled: boolean;
  tags: ModuleTag[];
  warnings: string[];
  moduleInfo?: {
    title?: string;
    au?: number;
    department?: string;
  };
}

export const EnhancedModuleSelector: React.FC<{
  courseBox: CourseBox;
  programmeId: string;
  sectionType: string;
  sectionPaths: PathInfo[];
  sectionBoxes: CourseBox[];
}> = ({ courseBox, programmeId, sectionType, sectionPaths, sectionBoxes }) => {
  const {
    selectModule,
    removeModule,
    getModuleInfo,
    getFilteredOptions,
    pendingDecision,
    resolveDecision,
    cancelDecision,
    isLoading,
    error,
    warnings,
    dbStatus,
    validationState,
    progressState
  } = usePlannerStore();

  const [selectedModule, setSelectedModule] = useState<ModuleCode | ''>('');
  const [options, setOptions] = useState<ModuleOption[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [showDecision, setShowDecision] = useState(false);

  const [altPaths, setAltPaths] = useState<any[]>([]);
  const [altPathLoading, setAltPathLoading] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string>('');


  // Load options
  const loadOptions = useCallback(async () => {
    if (!dbStatus.isConnected) return;
    setLocalLoading(true);
    try {
      const raw = await getFilteredOptions(
        courseBox.kind === 'dropdown' ? courseBox.moduleOptions :
          courseBox.kind === 'exact' ? [courseBox.moduleCode] : []
      );
      setOptions(
        raw.map(opt => ({
          module: opt.module,
          isDisabled: false,
          tags: opt.tags || [],
          warnings: opt.warnings || [],
          moduleInfo: opt.moduleInfo
        }))
      );
    } catch {
      // ignore
    } finally {
      setLocalLoading(false);
    }
  }, [courseBox, dbStatus.isConnected, getFilteredOptions]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Handlers
  const handleSelect = async (module: ModuleCode) => {
    setLocalLoading(true);
    const res = await selectModule(module, courseBox.boxKey);
    if (res.isValid) setSelectedModule(module);
    setLocalLoading(false);
  };

  const handleRemove = async () => {
    if (!selectedModule) return;
    setLocalLoading(true);
    await removeModule(selectedModule, courseBox.boxKey);
    setSelectedModule('');
    setLocalLoading(false);
  };

  const handleDecision = (programmes: string[]) => {
    resolveDecision(programmes);
    setShowDecision(false);
  };

  // AltPath selection
  const handlePathChange = (pathId: string) => {
    setSelectedPathId(pathId);
  };

  // Renderers per kind
  if (error) {
    return <Typography color="error">Error loading module selector</Typography>;
  }


  // -- FIND THE PATH DISPLAY LABEL FOR THIS BOX (all types)
  const pathInfo = sectionPaths.find((p) => p.pathId === courseBox.pathId);
  const boxTitle = pathInfo?.displayLabel || 'Unrestricted Elective'; // Not a good practice, but too troublesome to fix this

  switch (courseBox.kind) {
    case 'exact': {
      const [code, name] = courseBox.moduleCode.split('-', 2);
      const info = options[0]?.moduleInfo;
      return (
        <Box sx={{
          border: '1px solid #556DCC',
          borderRadius: 2,
          p: 1,
          width: 240,
          height: 120,
          bgcolor: '#556DCC40',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Typography variant="subtitle1" fontWeight={700}>{code}</Typography>
          <Typography variant="body2" align="center" noWrap>{name}</Typography>
          {info && (
            <Typography variant="caption" align="center" component="div">
              {info.title}<br />
              {info.au} AU
            </Typography>
          )}
        </Box>
      );
    }

    case 'dropdown': {
      const hasChosen = !!selectedModule;
      return (
        <Box sx={{
          border: '1px solid #CC55B3',
          borderRadius: 2,
          p: 1,
          width: 240,
          height: 120,
          bgcolor: '#CC55B340',
          position: 'relative'
        }}>
          {boxTitle && (
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              {boxTitle}
            </Typography>
          )}
          {(localLoading || isLoading) && (
            <CircularProgress size={24} sx={{ position: 'absolute', top: 8, right: 8 }} />
          )}
          <Autocomplete
            size="small"
            options={options}
            getOptionLabel={opt => opt.module}
            disableClearable
            onChange={(_, opt) => handleSelect(opt.module)}
            renderInput={params => <TextField {...params} label="Select module" />}
            renderOption={(props, opt) => (
              <li {...props} key={opt.module}>
                {opt.module} {opt.moduleInfo?.title} ({opt.moduleInfo?.au}AU)
              </li>
            )}
            value={options.find(o => o.module === selectedModule)}
          />
        </Box>
      );
    }

    case 'altPath': {
      const [selectedAltIdx, setSelectedAltIdx] = useState(0);

      // Get label for this box from pathInfo, as before
      const pathInfo = sectionPaths.find((p) => p.pathId === courseBox.pathId);
      const boxTitle = pathInfo?.displayLabel || '';
      const alternatives = courseBox.pathAlternatives || [];

      return (
        <Box
          sx={{
            border: '1px solid #6C8F35',
            borderRadius: 2,
            p: 1,
            minWidth: 300,
            bgcolor: '#6C8F3540'
          }}
        >
          {boxTitle && (
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              {boxTitle}
            </Typography>
          )}
          <Typography fontWeight={600} mb={1}>
            Choose an alternative path:
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Path</InputLabel>
            <Select
              label="Path"
              value={selectedAltIdx}
              onChange={e => setSelectedAltIdx(Number(e.target.value))}
            >
              {alternatives.map((alt, idx) => {
                const altPathInfo = sectionPaths.find((p) => p.pathId === alt.pathId);
                return (
                  <MenuItem key={alt.boxKey} value={idx}>
                    {altPathInfo?.displayLabel || alt.boxKey || `Path ${idx + 1}`}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          {/* Render the selected path's box */}
          {alternatives[selectedAltIdx] && (
            <BoxRenderer
              key={alternatives[selectedAltIdx].boxKey}
              box={alternatives[selectedAltIdx]}
              requirementKey={sectionType}
              sectionPaths={sectionPaths}
              sectionBoxes={sectionBoxes}
            />
          )}
        </Box>
      );
    }


    default:
      return null;
  }
};

export default EnhancedModuleSelector;
