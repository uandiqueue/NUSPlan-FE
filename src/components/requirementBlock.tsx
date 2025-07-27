import React, { useState, useEffect } from 'react';
import { ProgrammeSection, CourseBox, LookupMaps } from '../types/shared-types';
import { ModuleCode } from '../types/nusmods-types';
import { Box, Typography, Button, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BoxRenderer from './BoxRenderer';
import { dbService } from '../services/dbQuery';
import { usePlannerStore } from '../store/usePlannerStore';

export function RequirementBlock({
  block,
  programmeId,
}: {
  block: ProgrammeSection,
  programmeId: string,
}) {
  const isUE = block.groupType === 'unrestrictedElectives';

  const [addedBoxes, setAddedBoxes] = useState<CourseBox[]>([]);
  const [ueBoxes, setUeBoxes] = useState<CourseBox[]>([]);
  const [ueModuleOptions, setUeModuleOptions] = useState<ModuleCode[]>([]);
  const {lookupMaps} = usePlannerStore();

  // Load all module codes for UE
  useEffect(() => {
    if (!lookupMaps) {
      console.error('lookupMaps is missing in RequirementBlock for section', block);
      return;
    }
    async function loadUEOptions() {
      const allModuleCodes = dbService.extractAllModuleCodes(lookupMaps);
      setUeModuleOptions(Array.from(allModuleCodes));
    }
    loadUEOptions();
  }, [lookupMaps, isUE]);

  const handleAddUEBox = () => {
    const newBox: CourseBox = {
      kind: 'dropdown',
      boxKey: `ue-${Date.now()}`,
      pathId: 'UE',
      programmeId,
      moduleOptions: ueModuleOptions,
    };
    setUeBoxes((prev) => [...prev, newBox]);
  };

  const handleDeleteUEBox = (boxKey: string) => {
    setUeBoxes((prev) => prev.filter((box) => box.boxKey !== boxKey));
  };

  const handleAdd = () => {
    const nextIndex = addedBoxes.length;
    if (nextIndex < block.hidden.length) {
      setAddedBoxes((prev) => [...prev, block.hidden[nextIndex]]);
    }
  };

  const totalBoxes = isUE ? ueBoxes : [...block.courseBoxes, ...addedBoxes];

  const isDeletableBox = (box: CourseBox) => {
    return isUE || addedBoxes.some(b => b.boxKey === box.boxKey);
  };


  return (
    <Box mb={4} p={2} border="1px solid #ccc" borderRadius={2}>
      <Typography variant="h6" gutterBottom>
        {block.displayLabel}
      </Typography>

      <Box display="flex" flexWrap="wrap" gap={2}>
        {totalBoxes.map(box => (
          <Box
            key={`${block.groupType}-${box.boxKey}`}
            sx={{
              position: "relative",
              display: "inline-block",
            }}
          >
            <BoxRenderer
              box={box}
              requirementKey={block.groupType}
              sectionPaths={block.paths}
              sectionBoxes={totalBoxes}
            />
            {(isUE || addedBoxes.some(b => b.boxKey === box.boxKey)) && (
              <IconButton
                size="small"
                sx={{
                  position: "relative",
                  bottom: 40,
                  left: 220,
                  zIndex: 2,
                  bgcolor: 'white',
                  boxShadow: 1,
                }}
                onClick={() => {
                  if (isUE) handleDeleteUEBox(box.boxKey);
                  else setAddedBoxes(prev => prev.filter(b => b.boxKey !== box.boxKey));
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
      </Box>


      {/* Add button for UE or normal hidden boxes */}
      <Box display="flex" justifyContent="flex-end" mt={2}>
        {isUE ? (
          <Button variant="outlined" size="small" onClick={handleAddUEBox}>
            Add Elective
          </Button>
        ) : block.hidden.length > 0 ? (
          <Box display="flex" gap={1}>
            {block.hidden.map((hiddenBox, i) => {
              // Find title for this hiddenBox
              const pathInfo = block.paths.find((p) => p.pathId === hiddenBox.pathId);
              const boxTitle = pathInfo?.displayLabel || 'Requirement';
              return (
                <Button
                  key={hiddenBox.boxKey}
                  variant="outlined"
                  size="small"
                  onClick={() => setAddedBoxes(prev => [
                    ...prev,
                    { ...hiddenBox, boxKey: `${hiddenBox.boxKey}-${Date.now()}` }
                  ])}
                >
                  Add {boxTitle}
                </Button>
              );
            })}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
