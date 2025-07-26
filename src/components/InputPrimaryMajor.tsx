import { useMajorStore } from "../store/useMajorStore";
import { SelectChangeEvent } from "@mui/material/Select";
import {
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

function InputPrimaryMajor() {
  const { 
    availableMajors, 
    primaryMajor, 
    setPrimaryMajor, 
    isDuplicate 
  } = useMajorStore();

  const handleSelectPrimary = (e: SelectChangeEvent) => {
    const selectedId = e.target.value;
    const selectedProgramme = availableMajors.find(major => major.id === selectedId);
    if (selectedProgramme) {
      setPrimaryMajor({
        id: selectedProgramme.id,
        name: selectedProgramme.name
      });
    }
  };

  const handleDeletePrimary = () => {
    setPrimaryMajor(null);
  }

  const isError = primaryMajor ? isDuplicate(primaryMajor.id) : false;

  return (
    <Paper sx={{ p: 2, mb: 2, display: "flex", alignItems: "center" }}>
      <FormControl fullWidth error={isError}>
        <InputLabel>Primary Major</InputLabel>
        <Select
          value={primaryMajor ? primaryMajor.id : ""}
          label="Primary Major"
          onChange={handleSelectPrimary}
        >
          {availableMajors.map((major) => (
            <MenuItem
              key={major.id}
              value={major.id}
            >
              {major.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Tooltip title="Clear Primary Major choice">
        <IconButton onClick={handleDeletePrimary} sx={{ ml: 2 }}>
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

export default InputPrimaryMajor;
