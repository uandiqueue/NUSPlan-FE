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
  Stack,
  Chip,
  Tooltip,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
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
    getModuleTags, // //CHANGE: Use the actual service
    getPrerequisiteBoxes, // //CHANGE: Use the actual service
    getFilteredOptions,
    isLoading,
    error,
    warnings,
    validationState,
    progressState
  } = usePlannerStore();

  const [selectedModule, setSelectedModule] = useState<ModuleCode | ''>('');
  const [options, setOptions] = useState<ModuleOption[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [moduleDetails, setModuleDetails] = useState<any>(null);
  
  // //CHANGE: Actually use services for tags and prerequisites
  const [moduleTags, setModuleTags] = useState<ModuleTag[]>([]);
  const [moduleWarnings, setModuleWarnings] = useState<string[]>([]);
  const [prerequisiteBoxes, setPrerequisiteBoxes] = useState<CourseBox[]>([]);

  // Load options using the service
  const loadOptions = useCallback(async () => {
    setLocalLoading(true);
    try {
      const raw = await getFilteredOptions(
        courseBox.kind === 'dropdown' ? courseBox.moduleOptions :
          courseBox.kind === 'exact' ? [courseBox.moduleCode] : []
      );
      setOptions(
        raw.map(opt => ({
          module: opt.module,
          isDisabled: opt.isDisabled || false,
          tags: opt.tags || [],
          warnings: opt.warnings || [],
          moduleInfo: opt.moduleInfo
        }))
      );
    } catch (err) {
      console.error('Error loading options:', err);
    } finally {
      setLocalLoading(false);
    }
  }, [courseBox, getFilteredOptions]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // //CHANGE: Load module data using services when module is selected
  useEffect(() => {
    if (selectedModule) {
      const loadModuleData = async () => {
        try {
          // Get module tags using the service
          const tags = await getModuleTags(selectedModule);
          setModuleTags(tags);
          
          // Get module details using the service
          const details = await getModuleInfo(selectedModule);
          setModuleDetails(details);
          
          // Get prerequisite boxes using the service
          const prereqBoxes = getPrerequisiteBoxes(selectedModule);
          setPrerequisiteBoxes(prereqBoxes);
          
          // Check validation state for warnings
          const warnings: string[] = [];
          if (validationState.violatingModules.has(selectedModule)) {
            warnings.push('Module already used in maximum allowed requirements');
          }
          setModuleWarnings(warnings);
          
        } catch (error) {
          console.error('Error loading module data:', error);
        }
      };
      
      loadModuleData();
    } else {
      // Clear data when no module selected
      setModuleTags([]);
      setModuleDetails(null);
      setPrerequisiteBoxes([]);
      setModuleWarnings([]);
    }
  }, [selectedModule, getModuleTags, getModuleInfo, getPrerequisiteBoxes, validationState]);

  // //CHANGE: Check if module is currently selected by looking at validation state
  useEffect(() => {
    if (courseBox.kind === 'exact') {
      setSelectedModule(courseBox.moduleCode);
    } else {
      // Check if any module is selected for this box in validation state
      const boxModules = validationState.moduleToBoxMapping;
      for (const [module, boxKeys] of boxModules) {
        if (boxKeys.has(courseBox.boxKey)) {
          setSelectedModule(module);
          break;
        }
      }
    }
  }, [courseBox, validationState.moduleToBoxMapping]);

  // Handlers
  const handleSelect = async (module: ModuleCode) => {
    setLocalLoading(true);
    try {
      const res = await selectModule(module, courseBox.boxKey);
      if (res.isValid && !res.requiresDecision) {
        setSelectedModule(module);
      }
    } catch (error) {
      console.error('Error selecting module:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedModule) return;
    setLocalLoading(true);
    try {
      await removeModule(selectedModule, courseBox.boxKey);
      setSelectedModule('');
    } catch (error) {
      console.error('Error removing module:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  // //CHANGE: Render module tags properly
  const renderModuleTags = (tags: ModuleTag[]) => {
    if (tags.length === 0) return null;
    
    return (
      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
        {tags.map((tag, index) => (
          <Tooltip 
            key={index}
            title={tag.labels.map(label => 
              `${label.text}: ${label.context}`
            ).join('\n')}
            arrow
          >
            <Chip
              label={`${tag.type}${tag.labels.length > 1 ? `:${tag.labels.length}` : ''}`}
              size="small"
              color={tag.isFaded ? 'default' : tag.type === 'R' ? 'primary' : 'secondary'}
              variant={tag.isFaded ? 'outlined' : 'filled'}
              sx={{ 
                opacity: tag.isFaded ? 0.5 : 1,
                fontSize: '0.7rem'
              }}
            />
          </Tooltip>
        ))}
      </Stack>
    );
  };

  // //CHANGE: Get box styling based on validation state
  const getBoxStyling = () => {
    const isDisabled = selectedModule ? validationState.violatingModules.has(selectedModule) : false;
    const hasWarnings = moduleWarnings.length > 0;
    const hasStrippedTags = moduleTags.some(tag => tag.isFaded);
    const hasPrerequisites = prerequisiteBoxes.length > 0;
    
    return {
      borderColor: isDisabled ? '#f44336' : 
                   hasWarnings ? '#ff9800' : 
                   hasPrerequisites ? '#2196f3' : '#1976d2',
      backgroundColor: isDisabled ? '#ffebee' : 
                      hasStrippedTags ? '#fff3e0' : 
                      hasPrerequisites ? '#e3f2fd' : '#ffffff',
      borderWidth: selectedModule ? 2 : 1
    };
  };

  // Renderers per kind
  if (error) {
    return <Typography color="error">Error loading module selector</Typography>;
  }
  
  const pathInfo = sectionPaths.find((p) => p.pathId === courseBox.pathId);
  const boxTitle = pathInfo?.displayLabel || 'Requirement';
  const boxStyling = getBoxStyling();

  switch (courseBox.kind) {
    case 'exact': {
      const isPrerequisite = courseBox.isPrerequisite || false;
      const info = options[0]?.moduleInfo || moduleDetails;
      
      return (
        <Card sx={{
          border: `${boxStyling.borderWidth}px solid ${boxStyling.borderColor}`,
          borderRadius: 2,
          width: 240,
          minHeight: 120,
          bgcolor: boxStyling.backgroundColor,
          position: 'relative'
        }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            {/* //CHANGE: Show prerequisite indicator */}
            {isPrerequisite && (
              <Chip 
                label="PREREQ" 
                size="small" 
                color="info" 
                sx={{ 
                  position: 'absolute', 
                  top: 4, 
                  right: 4,
                  fontSize: '0.6rem'
                }} 
              />
            )}
            
            <Typography variant="h6" fontWeight={700} color="primary">
              {courseBox.moduleCode}
            </Typography>
            
            {info && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {info.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {info.au} AU {info.department && `• ${info.department}`}
                </Typography>
              </>
            )}
            
            {/* //CHANGE: Show tags and warnings */}
            {renderModuleTags(moduleTags)}
            
            {moduleWarnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1, fontSize: '0.7rem' }}>
                {moduleWarnings[0]}
              </Alert>
            )}
            
            {prerequisiteBoxes.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Chip 
                  icon={<AutoFixHighIcon />}
                  label={`${prerequisiteBoxes.length} prereq${prerequisiteBoxes.length > 1 ? 's' : ''}`} 
                  size="small" 
                  color="info"
                  variant="outlined"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      );
    }

    case 'dropdown': {
      const hasChosen = !!selectedModule;
      
      return (
        <Card sx={{
          border: `${boxStyling.borderWidth}px solid ${boxStyling.borderColor}`,
          borderRadius: 2,
          width: 240,
          minHeight: 120,
          bgcolor: boxStyling.backgroundColor,
          position: 'relative'
        }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            {boxTitle && (
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {boxTitle}
              </Typography>
            )}
            
            {(localLoading || isLoading) && (
              <CircularProgress size={24} sx={{ position: 'absolute', top: 8, right: 8 }} />
            )}
            
            {/* //CHANGE: Show warnings at top */}
            {moduleWarnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1, fontSize: '0.7rem' }}>
                {moduleWarnings[0]}
              </Alert>
            )}
            
            {hasChosen ? (
              <Box>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="body1" fontWeight={600} color="primary">
                    {selectedModule}
                  </Typography>
                  <Button size="small" onClick={handleRemove} color="error" variant="outlined">
                    Remove
                  </Button>
                </Box>
                
                {moduleDetails && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {moduleDetails.title} ({moduleDetails.module_credit} AU)
                  </Typography>
                )}
                
                {/* //CHANGE: Show module tags */}
                {renderModuleTags(moduleTags)}
                
                {/* //CHANGE: Show prerequisites */}
                {prerequisiteBoxes.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Chip 
                      icon={<AutoFixHighIcon />}
                      label={`${prerequisiteBoxes.length} prerequisite${prerequisiteBoxes.length > 1 ? 's' : ''} added`} 
                      size="small" 
                      color="info"
                    />
                  </Box>
                )}
              </Box>
            ) : (
              <Autocomplete
                size="small"
                options={options}
                getOptionLabel={opt => opt.module}
                getOptionDisabled={opt => opt.isDisabled}
                disableClearable
                loading={localLoading}
                onChange={(_, opt) => opt && handleSelect(opt.module)}
                renderInput={params => (
                  <TextField 
                    {...params} 
                    label="Select module"
                    error={moduleWarnings.length > 0}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {localLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, opt) => (
                  <li {...props} key={opt.module}>
                    <Box sx={{ width: '100%' }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {opt.module}
                        </Typography>
                        {opt.isDisabled && <BlockIcon fontSize="small" color="error" />}
                        {opt.warnings.length > 0 && <WarningIcon fontSize="small" color="warning" />}
                        {!opt.isDisabled && opt.warnings.length === 0 && <CheckCircleIcon fontSize="small" color="success" />}
                      </Box>
                      {opt.moduleInfo && (
                        <Typography variant="caption" color="text.secondary">
                          {opt.moduleInfo.title} ({opt.moduleInfo.au} AU)
                        </Typography>
                      )}
                      {/* //CHANGE: Show tags in dropdown */}
                      {opt.tags.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                          {opt.tags.slice(0, 2).map((tag, index) => (
                            <Chip
                              key={index}
                              label={tag.type}
                              size="small"
                              color={tag.type === 'R' ? 'primary' : 'secondary'}
                              sx={{ fontSize: '0.6rem', height: 16 }}
                            />
                          ))}
                          {opt.tags.length > 2 && (
                            <Typography variant="caption">+{opt.tags.length - 2}</Typography>
                          )}
                        </Stack>
                      )}
                    </Box>
                  </li>
                )}
              />
            )}
          </CardContent>
        </Card>
      );
    }

    case 'altPath': {
      const [selectedAltIdx, setSelectedAltIdx] = useState(0);
      const alternatives = courseBox.pathAlternatives || [];

      return (
        <Card
          sx={{
            border: '2px solid #6C8F35',
            borderRadius: 2,
            minWidth: 300,
            bgcolor: '#6C8F3520'
          }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            {boxTitle && (
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {boxTitle}
              </Typography>
            )}
            <Typography fontWeight={600} mb={2} color="text.secondary">
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
                      {altPathInfo?.displayLabel || `Path ${idx + 1}`}
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
          </CardContent>
        </Card>
      );
    }

    default:
      return null;
  }
};

export default EnhancedModuleSelector;