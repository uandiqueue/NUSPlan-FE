import type { RequirementSection } from '../types/shared/populator';
import { BoxRenderer } from './boxRenderer';
import { usePlanner } from '../hooks/usePlanner';
import { Box, Typography } from "@mui/material";

// Renders a single UI section block (“Core Electives” etc.)
export function RequirementBlock({ block }: { block: RequirementSection }) {
  // Read helpers from context
  const { progress } = usePlanner();

  // Call progress helper (function, not map)
  const { have, need } = progress(block.requirementKey); // current + required AUs

  return (
    <Box mb={4} p={2} border="1px solid #ccc" borderRadius={2}>
      {/* Section title + AU progress */}
      <Typography variant="h6" gutterBottom>
        {block.label} - {have}/{need} MC
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={2}>
        {block.boxes.map(b => <BoxRenderer key={b.boxKey} box={b} requirementKey={block.requirementKey}/>)}
      </Box>
    </Box >
  );
}
