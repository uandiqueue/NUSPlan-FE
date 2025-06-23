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
  const { majorList, primaryMajor, setPrimaryMajor, isDuplicate } =
    useMajorStore();

  const handleSelectPrimary = (e: SelectChangeEvent) => {
    setPrimaryMajor(e.target.value);
  };

  const handleDeletePrimary = () => {
    setPrimaryMajor("");
  }

  const isError = primaryMajor !== "" && isDuplicate(primaryMajor);

  return (
    <Paper sx={{ p: 2, mb: 2, display: "flex", alignItems: "center" }}>
      <FormControl fullWidth error={isError}>
        <InputLabel>Primary Major</InputLabel>
        <Select
          value={primaryMajor}
          label="Primary Major"
          onChange={handleSelectPrimary}
        >
          {majorList.map((major) => (
            <MenuItem
              key={major}
              value={major}
            >
              {major}
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
