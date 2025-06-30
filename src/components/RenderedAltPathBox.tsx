import { usePlannerStore } from '../store/usePlannerStore';
import type { AltPathBox, CourseBox, CourseInfo } from '../types/shared/populator';
import { Box, Typography, Autocomplete, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useState } from 'react';
import BoxRenderer from './boxRenderer';

// boxKey serves as a unique identifier for each box
// so this helper function collects all the box keys belonging to this alt path for cleanup
function collectBoxKeys(boxes: CourseBox[]): string[] {
    return boxes.flatMap(box => {
        if (box.kind === "altPath") {
            return box.paths.flatMap(path => collectBoxKeys(path.boxes));
        }
        return [box.boxKey];
    });
}

function RenderedAltPathBox({ box, requirementKey }: { box: AltPathBox, requirementKey: string }) {
    const {
        chosen,
        toggle,
    } = usePlannerStore();

    const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
    const selectedPath = box.paths.find(p => p.id === selectedPathId);

    // Clean up courses from old path when switching
    const handlePathChange = (newPathId: string) => {
        if (selectedPathId) {
            const prevPath = box.paths.find(p => p.id === selectedPathId); // get previous path
            if (prevPath) {
                const boxKeysToRemove = collectBoxKeys(prevPath.boxes); // get all box keys in previous path
                // Remove all courses in chosen whose boxKey is in boxKeysToRemove
                boxKeysToRemove.forEach(boxKey => {
                    const existing = chosen.find(selection => selection.boxKey === boxKey);
                    if (existing && existing.kind !== "exact") {
                        // toggle to help remove the course from chosen
                        toggle(existing.course, boxKey, requirementKey, existing.kind);
                    }
                });
            }
        }
        setSelectedPathId(newPathId);
    };

    return (
        <Box
            sx={{
                border: '1px solid #6C8F35',
                borderRadius: 2,
                padding: 2,
                minWidth: 250,
                backgroundColor: "#6C8F3540", // 25% opacity green
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
                        <BoxRenderer key={b.boxKey} box={b} requirementKey={requirementKey} /> // recursion
                    ))}
                </Box>
            )}
        </Box>
    );
}

export default RenderedAltPathBox;