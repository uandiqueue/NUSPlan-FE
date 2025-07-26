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
    availableSecondMajors,
    secondaryMajor,
    setSecondaryMajor,
    isDuplicate,
  } = useMajorStore();

  const {
    showSecondarySelect,
    setShowSecondarySelect,
  } = useUIStore();

  const handleSelectSecondary = (e: SelectChangeEvent) => {
    const selectedId = e.target.value;
    const selectedProgramme = availableSecondMajors.find(major => major.id === selectedId);
    if (selectedProgramme) {
      setSecondaryMajor({
        id: selectedProgramme.id,
        name: selectedProgramme.name
      });
    }
    setShowSecondarySelect(true);
  };

  const handleDeleteSecondary = () => {
    setSecondaryMajor(null);
    setShowSecondarySelect(false);
  }

  const isError = secondaryMajor ? isDuplicate(secondaryMajor.id) : false;

  // Data for other majors are not available
  const tempSecondaryList = ["Life Sciences"];

  return (
    <>
      {showSecondarySelect ? (
        <Paper sx={{ p: 2, mb: 2, display: "flex", alignItems: "center" }}>
          <FormControl fullWidth error={isError}>
            <InputLabel>Select Secondary Major</InputLabel>
            <Select
              value={secondaryMajor ? secondaryMajor.id : ""}
              label="Select Secondary Major"
              onChange={handleSelectSecondary}
            >
              {availableSecondMajors.map((major) => (
                <MenuItem
                  key={major.id}
                  value={major.id}
                >
                  {major.name}
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
