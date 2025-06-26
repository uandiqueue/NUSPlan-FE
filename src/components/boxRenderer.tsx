import { usePlanner } from '../hooks/usePlanner';
import type { CourseBox, CourseInfo } from '../types/shared/populator';
import { Box, Typography, Autocomplete, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useState } from 'react';

export function BoxRenderer({ box }: { box: CourseBox }) {
  const { chosen, toggle, canPick } = usePlanner();
  const isPicked = (c: CourseInfo) =>
    chosen.some(sel => sel.courseCode === c.courseCode);

  const commonBoxStyle = {
    border: '1px solid #ccc',
    borderRadius: 2,
    padding: 1,
    width: 240,
    height: 120,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  };

  switch (box.kind) {
    case 'exact': {
      const disabled = !canPick(box.course);
      return (
        <Box sx={{ ...commonBoxStyle, backgroundColor: '#f9f9f9', opacity: disabled ? 0.5 : 1 }}>
          <Typography variant="body2">
            {box.UILabel}
          </Typography>
        </Box>
      );
    }

    case 'dropdown': {
      const groupCodes = box.options.map(o => o.courseCode);
      const selected = box.options.find(isPicked);
      const disabledOptions = new Set(
        box.options.filter(o => !canPick(o)).map(o => o.courseCode)
      );

      return (
        <Box sx={commonBoxStyle}>
          <Typography
            variant="subtitle1"
            align="center"
            sx={{
              fontWeight: 600,
              fontSize: '1.25rem', // increase for better visibility
              lineHeight: 1.2,
              px: 0.5,
              mb: 0.5,
              whiteSpace: 'normal',
              wordWrap: 'break-word',
            }}
          >
            {box.UILabel}
          </Typography>
          <Autocomplete
            disableClearable
            options={box.options}
            value={selected ?? undefined}
            getOptionLabel={(option) => `${option.courseCode} – ${option.title}`}
            isOptionEqualToValue={(a, b) => a.courseCode === b.courseCode}
            onChange={(_, newValue) => {
              if (newValue) toggle(newValue, groupCodes);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                size="small"
                label={!selected ? 'Select your module' : undefined}
                sx={{
                  '& input': { fontSize: '1rem' },
                }}
              />
            )}
            renderOption={(props, option) => (
              <li
                {...props}
                key={option.courseCode}
                style={{
                  opacity: disabledOptions.has(option.courseCode) ? 0.5 : 1,
                  whiteSpace: 'normal',
                  wordWrap: 'break-word',
                }}
              >
                {option.courseCode} – {option.title}
              </li>
            )}
            sx={{
              width: '100%',
              fontSize: '0.75rem',
              '& .MuiInputBase-root': {
                fontSize: '0.75rem',
                height: '36px',
              },
            }}
          />
        </Box>
      );
    }

    case 'altPath': {
      const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
      const selectedPath = box.paths.find(p => p.id === selectedPathId);

      if (selectedPath) {
        return (
          <Box display="flex" flexWrap="wrap" gap={2}>
            {selectedPath.boxes.map((b) => (
              <BoxRenderer key={b.boxKey} box={b} />
            ))}
          </Box>
        );
      }

      return (
        <Box
          sx={{
            border: '1px solid #ccc',
            borderRadius: 2,
            padding: 2,
            width: 250,
            backgroundColor: '#f9f9f9',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}
        >
          <Typography variant="subtitle1" align="center" fontWeight={600}>
            {box.UILabel}
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel>Please select a path</InputLabel>
            <Select
              label="Please select a path"
              value=""
              onChange={(e) => {
                const selectedId = e.target.value;
                setSelectedPathId(selectedId);
              }}
            >
              {box.paths.map((path) => (
                <MenuItem key={path.id} value={path.id}>
                  {path.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      );
    }
  }
}
