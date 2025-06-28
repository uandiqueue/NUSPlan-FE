import { CircularProgress, Box, Typography } from "@mui/material";
import { usePlanner } from "../store/usePlanner";

export default function ProgressDonut() {
  const { payload, progress } = usePlanner();

  // Compute overall progress (sum of have / need across all sections)
  const sections = payload.requirements.map(sec => sec.requirementKey);
  const totalNeed = sections.reduce((sum, k) => sum + progress(k).need, 0);
  const totalHave = sections.reduce((sum, k) => sum + progress(k).have, 0);

  const percent = totalNeed === 0 ? 0 : Math.round((totalHave / totalNeed) * 100);

  return (
    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
      <CircularProgress variant="determinate" value={percent} size={120} thickness={5} />
      <Box
        top={0}
        left={0}
        bottom={0}
        right={0}
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography variant="h6" component="div">
          {percent}%
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {totalHave}/{totalNeed} MC fulfilled
      </Typography>
    </Box>
  );
}
