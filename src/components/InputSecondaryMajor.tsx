import { useMajorStore } from "../store/useMajorStore";
import { useUIStore } from "../store/useUIStore";
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

function InputSecondaryMajor() {
  const {
    majorList,
    secondaryMajor,
    setSecondaryMajor,
    isDuplicate,
  } = useMajorStore();

  const {
    showSecondarySelect,
    setShowSecondarySelect,
  } = useUIStore();

  const handleSelectSecondary = (e: SelectChangeEvent) => {
    setSecondaryMajor(e.target.value);
    setShowSecondarySelect(true);
  };

  const handleDeleteSecondary = () => {
    setSecondaryMajor("");
    setShowSecondarySelect(false);
  }

  const isError = secondaryMajor !== "" && isDuplicate(secondaryMajor);

  return (
    <>
      {showSecondarySelect ? (
        <Paper sx={{ p: 2, mb: 2, display: "flex", alignItems: "center" }}>
          <FormControl fullWidth error={isError}>
            <InputLabel>Select Secondary Major</InputLabel>
            <Select
              value={secondaryMajor}
              label="Select Secondary Major"
              onChange={handleSelectSecondary}
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
          <Tooltip title="Remove Secondary Major">
            <IconButton onClick={handleDeleteSecondary} sx={{ ml: 2 }}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Paper>
      ) : (
        <></>
      )}
    </>
  );
}

export default InputSecondaryMajor;
