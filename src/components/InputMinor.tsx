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
  const { majorList, minors, updateMinor, deleteMinor, isDuplicate } =
    useMajorStore();

  const handleSelectMinor = (e: SelectChangeEvent, index: number) => {
    updateMinor(e.target.value, index);
  };

  const minorFields = minors.map((minor, index) => {
    const isError = minor !== "" && isDuplicate(minor);

    return (
      <Paper
        key={index}
        sx={{ p: 2, mb: 2, display: "flex", alignItems: "center" }}
      >
        <FormControl fullWidth error={isError}>
          <InputLabel>Select Minor</InputLabel>
          <Select
            value={minor}
            label="Select Minor"
            onChange={(e) => handleSelectMinor(e, index)}
          >
            {majorList.map((major) => (
              <MenuItem key={major} value={major}>
                {major}
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
