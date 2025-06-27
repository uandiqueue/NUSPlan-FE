import { usePlanner } from '../hooks/usePlanner';
import type { CourseBox, CourseInfo } from '../types/shared/populator';
import { Box, Typography, Autocomplete, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useState } from 'react';

// Utility to collect course codes recursively from a CourseBox tree (for AltPath cleanup)
function collectCourseCodes(boxes: CourseBox[]): string[] {
  return boxes.flatMap(box => {
    switch (box.kind) {
      case "exact":
        return [box.course.courseCode];
      case "dropdown":
        return box.options.map(opt => opt.courseCode);
      case "altPath":
        return box.paths.flatMap(path => collectCourseCodes(path.boxes));
    }
  });
}

export function BoxRenderer({ box, requirementKey }: { box: CourseBox, requirementKey: string }) {
  const {
    chosen,
    toggle,
    canPick,
    isDuplicate, // From context
  } = usePlanner();

  console.log("chosen: ", chosen); // TO REMOVE

  // --- ExactBox ---
  if (box.kind === 'exact') {
    const disabled = !canPick(box.course);
    // Duplicates don't happen for exact boxes, so no need for error
    return (
      <Box sx={{
        border: '1px solid #ccc',
        borderRadius: 2,
        padding: 1,
        width: 240,
        height: 120,
        backgroundColor: '#f9f9f9',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
      }}>
        <Typography variant="body2">
          {box.UILabel}
        </Typography>
      </Box>
    );
  }

  // --- DropdownBox ---
  if (box.kind === 'dropdown') {
    const groupCodes = box.options.map(o => o.courseCode);
    const selected = chosen.find(sel => sel.boxKey === box.boxKey);
    const disabledOptions = new Set(
      box.options.filter(o => !canPick(o)).map(o => o.courseCode)
    );
    const hasDuplicate = selected
      ? isDuplicate(selected.course.courseCode, box.boxKey)
      : false;

    return (
      <Box sx={{
        border: hasDuplicate ? '2px solid #e11d48' : '1px solid #ccc',
        borderRadius: 2,
        padding: 1,
        width: 240,
        height: 120,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        backgroundColor: hasDuplicate ? '#fdf2f8' : '#fff',
      }}>
        <Typography
          variant="subtitle1"
          align="center"
          sx={{
            fontWeight: 600,
            fontSize: '1.1rem',
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
          value={selected ? selected.course : (null as unknown as CourseInfo)}
          getOptionLabel={(option) => `${option.courseCode} – ${option.title}`}
          isOptionEqualToValue={(a, b) => a.courseCode === b.courseCode}
          onChange={(_, newValue) => {
            if (newValue) toggle(newValue, box.boxKey, requirementKey, groupCodes);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              size="small"
              label={!selected ? 'Select your module' : undefined}
              error={hasDuplicate}
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

  // --- AltPathBox ---
  if (box.kind === 'altPath') {
    const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
    const selectedPath = box.paths.find(p => p.id === selectedPathId);

    // Clean up choices from old path when switching
    const handlePathChange = (newPathId: string) => {
      if (selectedPathId) {
        const prevPath = box.paths.find(p => p.id === selectedPathId);
        if (prevPath) {
          const toRemove = collectCourseCodes(prevPath.boxes);
          toRemove.forEach(courseCode => {
            if (chosen.some(sel => sel.course.courseCode === courseCode)) {
              // Remove from chosen (toggle removes if already picked)
              toggle({ courseCode, title: '', units: 0 }, '', '', undefined);
            }
          });
        }
      }
      setSelectedPathId(newPathId);
    };

    return (
      <Box
        sx={{
          border: '1px solid #ccc',
          borderRadius: 2,
          padding: 2,
          minWidth: 250,
          backgroundColor: '#f9f9f9',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 2,
          mb: 2,
          maxWidth: '100%',
        }}
      >
        <Box minWidth={160} maxWidth={220} mr={2}>
          <Typography variant="subtitle1" align="center" fontWeight={600}>
            {box.UILabel}
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Please select a path</InputLabel>
            <Select
              label="Please select a path"
              value={selectedPathId ?? ""}
              onChange={(e) => handlePathChange(e.target.value as string)}
            >
              {box.paths.map((path) => (
                <MenuItem key={path.id} value={path.id}>
                  {path.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {selectedPath && (
          <Box display="flex" flexDirection="row" flexWrap="wrap" gap={2}>
            {selectedPath.boxes.map((b) => (
              <BoxRenderer key={b.boxKey} box={b} requirementKey={requirementKey} />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Fallback: shouldn't ever hit this
  return null;
}
