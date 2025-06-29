import { usePlannerStore } from '../store/usePlannerStore';
import type { CourseBox, CourseInfo } from '../types/shared/populator';
import { Box, Typography, Autocomplete, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useState } from 'react';

// helper function for AltPath cleanup
function collectBoxKeys(boxes: CourseBox[]): string[] {
  return boxes.flatMap(box => {
    if (box.kind === "altPath") {
      return box.paths.flatMap(path => collectBoxKeys(path.boxes));
    }
    return [box.boxKey];
  });
}

function getBoxBg(kind: "exact" | "dropdown" | "altPath"): string {
  switch (kind) {
    case "exact":
      return "#354B8F40";      // blue, 25% opacity for all, 255 * 0.25 = 40
    case "dropdown":
      return "#CC55B340";      // pink
    case "altPath":
      return "#6C8F3540";      // green
    default:
      return "#fff";
  }
}

export function BoxRenderer({ box, requirementKey }: { box: CourseBox, requirementKey: string }) {
  const {
    chosen,
    toggle,
    canPick,
    isDuplicate, // From context
    programmes,
    selectedProgramIndex
  } = usePlannerStore();

  console.log("chosen: ", chosen); // DEBUG

  // --- ExactBox ---
  if (box.kind === 'exact') {
    const disabled = !canPick(box.course);

    // UILabel follows the format <courseCode> - <courseName>
    const [courseCode, courseName] = box.UILabel.split(" - ", 2);
    const boxBg = getBoxBg("exact");
    return (
      <Box sx={{
        border: '1px solid #354B8F',
        borderRadius: 2,
        padding: 1,
        width: 240,
        height: 120,
        backgroundColor: boxBg,
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'stretch',
      }}>
        <Typography variant="subtitle1" fontWeight={700} align="center" sx={{ fontSize: '1.2rem', mb: 0.5 }}>
          {courseCode}
        </Typography>
        <Typography variant="body2" align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '1rem' }}>
          {courseName}
        </Typography>
      </Box>
    );
  }

  {/* Dropdown Box */ }
  if (box.kind === 'dropdown') {
    const groupCodes = box.options.map(o => o.courseCode);
    const selected = chosen.find(sel => sel.boxKey === box.boxKey);
    const currentProgramme = programmes[selectedProgramIndex];
    const tagsMap = currentProgramme?.lookup.tags ?? [];

    // Find all course codes picked as exact (read-only)
    const readOnlyCodes = new Set(
      chosen.filter(sel => sel.kind === "exact").map(sel => sel.course.courseCode)
    );

    // Filtered courses based on the tagMap, but doesnt seem to work, so a quick fix above to filter out read-only courses
    const filteredCourses = box.options.filter(opt => {
      // Exclude courses that are read-only
      if (readOnlyCodes.has(opt.courseCode)) return false;
      // Only include if tags include the requirementKey (substring match)
      const taggedCourse = tagsMap[opt.courseCode] ?? [];
      return taggedCourse.some(tag => tag.includes(requirementKey));
    });

    const hasDuplicate = selected
      ? isDuplicate(selected.course.courseCode, box.boxKey)
      : false;

    const boxBg = getBoxBg("dropdown");
    return (
      <Box sx={{
        border: hasDuplicate ? '2px solid #e11d48' : '1px solid #CC55B3',
        borderRadius: 2,
        padding: 1,
        width: 240,
        height: 120,
        backgroundColor: boxBg,
      }}>
        <Typography
          variant="subtitle1"
          align="center"
          sx={{
            fontWeight: 600,
            fontSize: '1.1rem',
            lineHeight: 1.2,
            px: 0.5,
            mb: 2,
            whiteSpace: 'normal',
            wordWrap: 'break-word',
          }}
        >
          {box.UILabel}
        </Typography>
        <Autocomplete
          options={filteredCourses}
          value={selected ? selected.course : (null as unknown as CourseInfo)}
          getOptionLabel={(option) => option ? `${option.courseCode} – ${option.title}` : ""}
          isOptionEqualToValue={(a, b) => a.courseCode === b.courseCode}
          onChange={(_, newValue) => {
            if (newValue) {
              toggle(newValue, box.boxKey, requirementKey, "dropdown", groupCodes);
            } else if (selected) {
              // User cleared selection, toggle will remove from chosen
              toggle(selected.course, box.boxKey, requirementKey, "dropdown", groupCodes);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              size="small"
              label={!selected ? 'Select your module' : undefined} // show only if no course is selected
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
        // 1. Find the previous path
        const prevPath = box.paths.find(p => p.id === selectedPathId);
        if (prevPath) {
          // 2. Get all boxKeys in the previous path
          const boxKeysToRemove = collectBoxKeys(prevPath.boxes);
          // 3. Remove all choices in `chosen` whose boxKey is in boxKeysToRemove
          boxKeysToRemove.forEach(boxKey => {
            const existing = chosen.find(sel => sel.boxKey === boxKey);
            if (existing && existing.kind !== "exact") {
              // Call toggle to remove user choices (won't remove read-only/exact)
              toggle(existing.course, boxKey, requirementKey, existing.kind);
            }
          });
        }
      }
      setSelectedPathId(newPathId);
    };


    const boxBg = getBoxBg("altPath");
    return (
      <Box
        sx={{
          border: '1px solid #6C8F35',
          borderRadius: 2,
          padding: 2,
          minWidth: 250,
          backgroundColor: boxBg,
        }}
      >
        <Box minWidth={160} maxWidth={220} mr={2}>
          <Typography variant="subtitle1" align="center" fontWeight={600}>
            {box.UILabel}
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 2 }}>
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
          <Box display="flex" flexDirection="row" flexWrap="wrap" gap={2} sx={{ mt: 2 }}>
            {selectedPath.boxes.map((b) => (
              <BoxRenderer key={b.boxKey} box={b} requirementKey={requirementKey} />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // shouldn't reach this
  return null;
}
