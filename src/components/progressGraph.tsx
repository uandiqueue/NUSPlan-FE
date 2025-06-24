import { usePlanner } from '../hooks/usePlanner';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Box, Typography } from '@mui/material';

// Donut chart of total units earned per requirement section
export function ProgressGraph() {
  const { payload, progress } = usePlanner();

  // Build data using the progress() helper
  const data = payload.requirements.map(r => {
    const { have } = progress(r.requirementKey);
    return { name: r.label, value: have };
  });

  const positive = data.filter(d => d.value > 0);
  if (positive.length === 0) {
    return <Typography variant="body2">No MC earned yet</Typography>;
  }

  // Simple colour palette
  const colours = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#64748b'];
  const chartKey = JSON.stringify(positive); // force redraw when data changes

  return (
    <Box sx={{ width: 260, height: 260 }}>
      <PieChart width={260} height={260} key={chartKey}>
        <Pie
          data={positive}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={120}
          isAnimationActive={false}
          label={({ value }) => `${value} MC`}
          labelLine={false}
        >
          {positive.map((_, i) => (
            <Cell key={i} fill={colours[i % colours.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => `${v} MC`} />
      </PieChart>
    </Box>
  );
}
