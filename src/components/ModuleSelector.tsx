import React, { useEffect, useCallback, useState } from 'react';
import type { ModuleCode } from '../types/nusmods-types';
import type { CourseBox, PathInfo, RequirementGroupType } from '../types/shared-types';
import type { ModuleTag } from '../types/frontend-types';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  Box,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Button,
} from '@mui/material';
import BoxRenderer from './boxRenderer';

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

export const ModuleSelector: React.FC<{
  courseBox: CourseBox;
  programmeId: string;
  sectionType: string;
  sectionPaths: PathInfo[];
  sectionBoxes: CourseBox[];
}> = ({
  courseBox,
  programmeId,
  sectionType,
  sectionPaths,
  sectionBoxes,
}) => {
  const {
    getFilteredOptions,
    isLoading,
    error,
    userPathSelections,
    setPathSelection,
    userModuleSelections,
    setBoxModuleSelection,
    removeBoxModuleSelection,
    removeAllModulesUnderPath,
  } = usePlannerStore();

  const groupType = sectionType as RequirementGroupType;
  const currentSelection = userModuleSelections.find(
    s =>
      s.programmeId === programmeId &&
      s.groupType === groupType &&
      s.pathId === courseBox.pathId &&
      s.boxKey === courseBox.boxKey
  )?.selectedModule || '';

  const [options, setOptions] = useState<ModuleOption[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    setLocalLoading(true);
    try {
      const raw = await getFilteredOptions(
        courseBox.kind === 'dropdown'
          ? courseBox.moduleOptions
          : courseBox.kind === 'exact'
            ? [courseBox.moduleCode]
            : []
      );
      setOptions(
        raw.map(opt => ({
          module: opt.module,
          isDisabled: false,
          tags: opt.tags || [],
          warnings: opt.warnings || [],
          moduleInfo: opt.moduleInfo,
        }))
      );
    } catch {
      // ignore
    } finally {
      setLocalLoading(false);
    }
  }, [courseBox, getFilteredOptions]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const handleSelect = (module: ModuleCode) => {
    setBoxModuleSelection(
      programmeId,
      groupType,
      courseBox.pathId,
      courseBox.boxKey,
      module
    );
  };

  const handleRemove = () => {
    removeBoxModuleSelection(
      programmeId,
      groupType,
      courseBox.pathId,
      courseBox.boxKey
    );
  };

  const alternatives = courseBox.kind === 'altPath' ? courseBox.pathAlternatives || [] : [];
  const currentAltPathId = userPathSelections.find(
    sel => sel.programmeId === programmeId && sel.groupType === groupType
  )?.pathId || (alternatives[0]?.pathId ?? '');

  const selectedAltIdx = Math.max(
    alternatives.findIndex(alt => alt.pathId === currentAltPathId),
    0
  );

  const removeAltPathModules = useCallback((altBox: CourseBox) => {
    removeAllModulesUnderPath(programmeId, groupType, altBox.pathId, altBox);
  }, [programmeId, groupType, removeAllModulesUnderPath]);

  const handleAltPathChange = (newIdx: number) => {
    const prevAlt = alternatives[selectedAltIdx];
    if (prevAlt) {
      removeAltPathModules(prevAlt);
    }
    const newAlt = alternatives[newIdx];
    if (newAlt) {
      setPathSelection(programmeId, groupType, newAlt.pathId);
    }
  };

  if (error) {
    return <Typography color="error">Error loading module selector</Typography>;
  }

  const pathInfo = sectionPaths.find((p) => p.pathId === courseBox.pathId);
  const boxTitle = pathInfo?.displayLabel || 'Unrestricted Elective';

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
      const displayOptions = currentSelection && !options.some(o => o.module === currentSelection)
        ? [{ module: currentSelection, isDisabled: true, tags: [], warnings: [] }, ...options]
        : options;
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
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id={`select-label-${courseBox.boxKey}`}>Select module</InputLabel>
            <Select
              labelId={`select-label-${courseBox.boxKey}`}
              label="Select module"
              value={currentSelection || ''}
              onChange={e => handleSelect(e.target.value)}
              renderValue={value => {
                const opt = displayOptions.find(o => o.module === value);
                return opt ? `${opt.module}${opt.moduleInfo?.title ? ` — ${opt.moduleInfo.title}` : ''}` : '';
              }}
            >
              <MenuItem value="">None</MenuItem>
              {displayOptions.map(opt => (
                <MenuItem
                  key={opt.module}
                  value={opt.module}
                  disabled={!!opt.isDisabled}
                  style={opt.isDisabled ? { fontStyle: "italic", opacity: 0.7 } : {}}
                >
                  {opt.module}
                  {opt.moduleInfo?.title ? ` — ${opt.moduleInfo.title}` : ''}
                  {opt.moduleInfo?.au ? ` (${opt.moduleInfo.au}AU)` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {currentSelection && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleRemove}
              sx={{ position: "absolute", right: 8, bottom: 8, fontSize: "0.7rem", px: 1.5 }}
            >
              Remove
            </Button>
          )}
        </Box>
      );
    }
    case 'altPath': {
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
              onChange={e => handleAltPathChange(Number(e.target.value))}
            >
              {alternatives.map((alt, idx) => {
                const altPath = sectionPaths.find((p) => p.pathId === alt.pathId);
                return (
                  <MenuItem key={alt.boxKey} value={idx}>
                    {altPath?.displayLabel || alt.boxKey || `Path ${idx + 1}`}
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

export default ModuleSelector;
