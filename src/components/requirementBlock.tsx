import React, { useState, useEffect } from 'react';
import { ProgrammeSection, CourseBox, RequirementGroupType } from '../types/shared-types';
import { ModuleCode } from '../types/nusmods-types';
import { Box, Typography, Button, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BoxRenderer from './boxRenderer';
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
  const groupType = block.groupType as RequirementGroupType;

  const {
    lookupMaps,
    userAddedBoxes,
    addUserBox,
    removeUserBox,
    removeBoxModuleSelection,
    userModuleSelections
  } = usePlannerStore();

  const [ueModuleOptions, setUeModuleOptions] = useState<ModuleCode[]>([]);
  useEffect(() => {
    if (!lookupMaps) return;
    async function loadUEOptions() {
      const allModuleCodes = dbService.extractAllModuleCodes(lookupMaps);
      setUeModuleOptions(Array.from(allModuleCodes));
    }
    loadUEOptions();
  }, [lookupMaps, isUE]);

  // User added boxes for this section
  const addedBoxes = userAddedBoxes
    .filter(b => b.programmeId === programmeId && b.groupType === groupType)
    .map(b => b.box);

  // Combine default and added boxes
  const visibleBoxes = [
    ...block.courseBoxes,
    ...addedBoxes
  ];

  // Helper function
  const isDeletableBox = (box: CourseBox) =>
    isUE || addedBoxes.some(b => b.boxKey === box.boxKey);

  const handleAddUEBox = () => {
    const newBox: CourseBox = {
      kind: 'dropdown',
      boxKey: `ue-${Date.now()}`,
      pathId: 'UE',
      programmeId,
      moduleOptions: ueModuleOptions,
    };
    addUserBox(programmeId, groupType, newBox);
  };

  // Remove elective
  const handleDeleteUEBox = (boxKey: string) => {
    removeUserBox(programmeId, groupType, boxKey);
    removeBoxModuleSelection(programmeId, groupType, 'UE', boxKey);
  };

  // Add hidden box
  const handleAddHidden = (hiddenBox: CourseBox) => {
    const newBox = { ...hiddenBox, boxKey: `${hiddenBox.boxKey}-${Date.now()}` };
    addUserBox(programmeId, groupType, newBox);
  };

  // Remove hidden
  const handleDeleteBox = (boxKey: string, pathId: string) => {
    removeUserBox(programmeId, groupType, boxKey);
    removeBoxModuleSelection(programmeId, groupType, pathId, boxKey);
  };

  return (
    <Box mb={4} p={2} border="1px solid #ccc" borderRadius={2}>
      <Typography variant="h6" gutterBottom>
        {block.displayLabel}
      </Typography>

      <Box display="flex" flexWrap="wrap" gap={2}>
        {visibleBoxes.map(box => (
          <Box
            key={`${block.groupType}-${box.boxKey}`}
            sx={{ position: "relative", display: "inline-block" }}
          >
            <BoxRenderer
              box={box}
              requirementKey={block.groupType}
              sectionPaths={block.paths}
              sectionBoxes={visibleBoxes}
            />
            {isDeletableBox(box) && (
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
                onClick={() =>
                  isUE
                    ? handleDeleteUEBox(box.boxKey)
                    : handleDeleteBox(box.boxKey, box.pathId)
                }
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
      </Box>

      {/* Add elective or hidden requirement buttons */}
      <Box display="flex" justifyContent="flex-end" mt={2}>
        {isUE ? (
          <Button variant="outlined" size="small" onClick={handleAddUEBox}>
            Add Elective
          </Button>
        ) : block.hidden.length > 0 ? (
          <Box display="flex" gap={1}>
            {block.hidden.map((hiddenBox) => {
              const pathInfo = block.paths.find((p) => p.pathId === hiddenBox.pathId);
              const boxTitle = pathInfo?.displayLabel || 'Requirement';
              return (
                <Button
                  key={hiddenBox.boxKey}
                  variant="outlined"
                  size="small"
                  onClick={() => handleAddHidden(hiddenBox)}
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

export default RequirementBlock;
