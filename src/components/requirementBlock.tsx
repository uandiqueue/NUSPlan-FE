import React, { useState, useMemo } from 'react';
import type { ProgrammeSection, CourseBox } from '../types/shared-types';
import { Box, Typography, Button } from '@mui/material';
import BoxRenderer from './BoxRenderer';

// Renders a single program requirement section (e.g., Core Electives)
export function RequirementBlock({ block }: { block: ProgrammeSection }) {


  // State for any hidden boxes the user has added
  const [addedBoxes, setAddedBoxes] = useState<CourseBox[]>([]);

  // Combine original and newly-added boxes
  const totalBoxes = [...block.courseBoxes, ...addedBoxes];

  // Handler to add the next hidden box
  const handleAdd = () => {
    const nextIndex = addedBoxes.length;
    // Add next hidden box if available
    if (nextIndex < block.hidden.length) {
      setAddedBoxes(prev => [...prev, block.hidden[nextIndex]]);
    }
  };

  return (
    <Box mb={4} p={2} border="1px solid #ccc" borderRadius={2}>
      <Typography variant="h6" gutterBottom>
        {block.displayLabel}
      </Typography>

      <Box display="flex" flexWrap="wrap" gap={2}>
        {totalBoxes.map(box => (
          <BoxRenderer
            key={`${block.groupType}-${box.boxKey}`}
            box={box}
            requirementKey={block.groupType}
            sectionPaths={block.paths}
            sectionBoxes={totalBoxes}
          />
        ))}
      </Box>

      {/* Show Add button for sections with hidden boxes */}
      {block.hidden.length > 0 && (
        <Box display="flex" justifyContent="flex-end" mt={2}>
          <Button variant="outlined" size="small" onClick={handleAdd}>
            Add
          </Button>
        </Box>
      )}
    </Box>
  );
}
