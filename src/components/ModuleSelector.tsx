import React, { useState, useEffect, useCallback } from 'react';
import type { ModuleCode } from '../types/nusmods-types';
import type { CourseBox } from '../types/shared-types';
import type { ModuleTag, PendingDecision } from '../types/frontend-types';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress
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
}> = ({ courseBox, programmeId, sectionType }) => {
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
            <Typography variant="caption">{info.au} AU</Typography>
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
          {(localLoading || isLoading) && (
            <CircularProgress size={24} sx={{ position:'absolute', top:8, right:8 }}/>
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
                {opt.module} {opt.moduleInfo?.title} {opt.moduleInfo?.au}AU
              </li>
            )}
            value={options.find(o => o.module === selectedModule)}
          />
        </Box>
      );
    }

    case 'altPath': {
      return (
        <Box sx={{
          border: '1px solid #6C8F35',
          borderRadius: 2,
          p: 1,
          minWidth: 250,
          bgcolor: '#6C8F3540'
        }}>
          <FormControl fullWidth size="small">
            <InputLabel>Select path</InputLabel>
            <Select
              value={selectedPathId}
              label="Select path"
              onChange={e => handlePathChange(e.target.value as string)}
            >
              {(courseBox as any).paths?.map((p: any) => (
                <MenuItem key={p.id} value={p.id}>{p.id}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedPathId && (
            <Box display="flex" flexWrap="wrap" gap={2} sx={{ mt:1 }}>
              {((courseBox as any).paths.find((p: any) => p.id === selectedPathId)?.boxes || [])
                .map((b: CourseBox) => (
                  <BoxRenderer key={b.boxKey} box={b} requirementKey={sectionType} />
                ))}
            </Box>
          )}
        </Box>
      );
    }

    default:
      return null;
  }
};

export default EnhancedModuleSelector;
