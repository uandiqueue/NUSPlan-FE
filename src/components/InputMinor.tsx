import { useMajorStore } from "../store/useMajorStore";
import { SelectChangeEvent } from "@mui/material/Select";
import {
  Paper,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  MenuItem,
  Tooltip
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

function InputMinor() {
  const { 
    availableMinors, 
    minors, 
    updateMinor, 
    deleteMinor, 
    isDuplicate 
  } = useMajorStore();

  const handleSelectMinor = (e: SelectChangeEvent, index: number) => {
    const selectedId = e.target.value;
    const selectedProgramme = availableMinors.find(minor => minor.id === selectedId);
    if (selectedProgramme) {
      updateMinor({
        id: selectedProgramme.id,
        name: selectedProgramme.name
      }, index);
    }
  };

  const minorFields = minors.map((minor, index) => {
    const isError = minor ? isDuplicate(minor.id) : false;

    return (
      <Paper
        key={index}
        sx={{ p: 2, mb: 2, display: "flex", alignItems: "center" }}
      >
        <FormControl fullWidth error={isError}>
          <InputLabel>Select Minor</InputLabel>
          <Select
            value={minor ? minor.id : ""}
            label="Select Minor"
            onChange={(e) => handleSelectMinor(e, index)}
          >
            {availableMinors.map((minorOption) => (
            <MenuItem
              key={minorOption.id}
              value={minorOption.id}
            >
              {minorOption.name}
            </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Clear Minor choice">
          <IconButton
            onClick={() => deleteMinor(index)}
            sx={{ ml: 2 }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Paper>
    );
  });

  return <>{minorFields}</>;
}

export default InputMinor;
