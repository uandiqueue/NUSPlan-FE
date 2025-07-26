import React from 'react';
import type { ProgrammeSection } from '../types/shared-types';
import { Box, Typography } from '@mui/material';
import { usePlannerStore } from '../store/usePlannerStore';
import BoxRenderer from "./BoxRenderer";

// Renders a single program requirement section (e.g., Core Electives)
export function RequirementBlock({ block }: { block: ProgrammeSection }) {
  // no need for programmeId here, BoxRenderer will handle selectors

  return (
    <Box mb={4} p={2} border="1px solid #ccc" borderRadius={2}>
      <Typography variant="h6" gutterBottom>
        {block.displayLabel}
      </Typography>

      <Box display="flex" flexWrap="wrap" gap={2}>
        {block.courseBoxes.map(box => (
          <BoxRenderer
            key={`${block.groupType}-${box.boxKey}`}
            box={box}
            requirementKey={block.groupType}
          />
        ))}
      </Box>
    </Box>
  );
}