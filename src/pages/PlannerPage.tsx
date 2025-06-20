import { useContext } from 'react';
import { Box, Button, Typography, Divider, useTheme, useMediaQuery, } from '@mui/material';
import { PayloadContext } from '../app/context/payloadContext';
import { RequirementBlock } from '../components/requirementBlock';
import { ProgressGraph } from '../components/progressGraph';

export interface PlannerPageProps {
  onBack: () => void;
}

export default function PlannerPage({ onBack }: PlannerPageProps) {
  const ctx = useContext(PayloadContext);
  const theme = useTheme();
  const upLg = useMediaQuery(theme.breakpoints.up('lg'));

  if (!ctx) {
    return (
      <Box p={4}>
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  const { payload } = ctx;

  return (
    <Box p={4}>
      <Button variant="text" size="small" onClick={onBack} sx={{ mb: 2 }}>
        ← Back to programme selection
      </Button>

      <Box
        display="grid"
        gap={4}
        gridTemplateColumns={upLg ? '2fr 1fr' : '1fr'}
      >
        {/* requirement blocks */}
        <Box>
          {payload.requirements.map((block, i) => (
            <RequirementBlock
              key={`${block.requirementKey}-${i}`}
              block={block}
            />
          ))}
        </Box>

        {/* progress graph */}
        <Box position="sticky" top={16}>
          <Typography variant="h6" gutterBottom>
            Progress
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <ProgressGraph />
        </Box>
      </Box>
    </Box>
  );
}
