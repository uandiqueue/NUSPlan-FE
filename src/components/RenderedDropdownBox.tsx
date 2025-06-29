import { usePlannerStore } from '../store/usePlannerStore';
import type { DropdownBox, CourseInfo } from '../types/shared/populator';
import { Box, Typography, Autocomplete, TextField } from '@mui/material';

function RenderedDropdownBox({ box, requirementKey }: { box: DropdownBox, requirementKey: string}) {
  const {
    chosen,
    toggle,
    isDuplicate,
    programmes,
    selectedProgramIndex
  } = usePlannerStore();

  const groupCodes = box.options.map(o => o.courseCode);
  const selected = chosen.find(sel => sel.boxKey === box.boxKey);
  const currentProgramme = programmes[selectedProgramIndex];
  const tagsMap = currentProgramme?.lookup.tags ?? [];

  // Find all read-only courses
  const readOnlyCourses = new Set(
    chosen.filter(selection => selection.kind === "exact").map(selection => selection.course.courseCode)
  );

  // Filtered courses based on the tagMap, but doesnt seem to work, so a quick fix above to filter out read-only courses
  const filteredCourses = box.options.filter(opt => {
    // Exclude courses that are read-only
    if (readOnlyCourses.has(opt.courseCode)) return false;

    // Only include if tags include the requirementKey (substring match)
    const taggedCourse = tagsMap[opt.courseCode] ?? [];
    return taggedCourse.some(tag => tag.includes(requirementKey));
  });

  const hasDuplicate = selected
    ? isDuplicate(selected.course.courseCode, box.boxKey)
    : false;

  return (
    <Box sx={{
      border: hasDuplicate ? '2px solid #e11d48' : '1px solid #CC55B3',
      borderRadius: 2,
      padding: 1,
      width: 240,
      height: 120,
      backgroundColor: "#CC55B340", // 25% opacity pink 
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
            // user clear selection, toggle will help to remove the course from chosen
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

export default RenderedDropdownBox;