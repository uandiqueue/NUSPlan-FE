import type { RequirementSection } from '../types/shared/populator';
import { BoxRenderer } from './boxRenderer';
import { usePlanner } from '../store/usePlanner';
import { Box, Typography } from "@mui/material";

// Renders a single UI section block (“Core Electives” etc.)
export function RequirementBlock({ block }: { block: RequirementSection }) {
  const progressFn = usePlanner(state => state.progress); // gets function only once
  const { have, need } = progressFn(block.requirementKey); // call only once

  return (
    <Box mb={4} p={2} border="1px solid #ccc" borderRadius={2}>
      <Typography variant="h6" gutterBottom>
        {block.label} – {have}/{need} MC
      </Typography>

      <Box display="flex" flexWrap="wrap" gap={2}>
        {block.boxes.map(b => (
          <BoxRenderer key={`${block.requirementKey}:${b.boxKey}`} box={b} requirementKey={block.requirementKey} />
        ))}
      </Box>
    </Box>
  );
}
