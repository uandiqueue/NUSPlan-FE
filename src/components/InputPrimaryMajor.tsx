import { useMajorStore } from "../store/useMajorStore";
import { SelectChangeEvent } from "@mui/material/Select";
import {
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

function InputPrimaryMajor() {
  const { majorList, primaryMajor, setPrimaryMajor, isDuplicate } =
    useMajorStore();

  const handleSelectPrimary = (e: SelectChangeEvent) => {
    setPrimaryMajor(e.target.value);
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <FormControl fullWidth>
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
              disabled={isDuplicate(major) && major !== primaryMajor}
            >
              {major}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Paper>
  );
}

export default InputPrimaryMajor;
