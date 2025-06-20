import { usePlanner } from '../hooks/usePlanner';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Box, Typography } from '@mui/material';

export function ProgressGraph() {
  const { progress } = usePlanner();
  const data = Object.entries(progress).map(([name, value]) => ({
    name,
    value: Number(value),
  }));
  const positive = data.filter((d) => d.value > 0);

  if (positive.length === 0) {
    return <Typography variant="body2">No MC earned yet</Typography>;
  }

  const chartKey = JSON.stringify(positive);
  const colours = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#64748b'];

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
