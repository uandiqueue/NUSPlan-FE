import React, { useState, useEffect } from 'react';
import { ProgrammeSection, CourseBox, LookupMaps } from '../types/shared-types';
import { ModuleCode } from '../types/nusmods-types';
import { Box, Typography, Button, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BoxRenderer from './BoxRenderer';
import { dbService } from '../services/dbQuery';

// Renders a single program requirement section (e.g., Core Electives)
export function RequirementBlock({
  block,
  programmeId,
  lookupMaps,
}: {
  block: ProgrammeSection,
  programmeId: string,
  lookupMaps: LookupMaps,
}) {
  const isUE = block.groupType === 'unrestrictedElectives';

  const [addedBoxes, setAddedBoxes] = useState<CourseBox[]>([]);
  const [ueBoxes, setUeBoxes] = useState<CourseBox[]>([]);
  const [ueModuleOptions, setUeModuleOptions] = useState<ModuleCode[]>([]);

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
            {isUE && (
              <IconButton
                size="small"
                sx={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  zIndex: 2,
                  bgcolor: 'white',
                  boxShadow: 1,
                }}
                onClick={() => handleDeleteUEBox(box.boxKey)}
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
          <Button variant="outlined" size="small" onClick={handleAdd}>
            Add
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}

