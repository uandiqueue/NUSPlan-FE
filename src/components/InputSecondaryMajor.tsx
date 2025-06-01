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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

function InputSecondaryMajor() {
  const {
    majorList,
    secondaryMajor,
    setSecondaryMajor,
    isDuplicate,
    deleteSecondary,
  } = useMajorStore();

  const {
    showSecondarySelect,
    setShowSecondarySelect,
    confirmDeleteSecondary,
    setConfirmDeleteSecondary,
  } = useUIStore();

  const handleSelectSecondary = (e: SelectChangeEvent) => {
    setSecondaryMajor(e.target.value);
    setShowSecondarySelect(true);
  };

  return (
    <>
      {showSecondarySelect ? (
        <Paper sx={{ p: 2, mb: 2, display: "flex", alignItems: "center" }}>
          <FormControl fullWidth>
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
                  disabled={isDuplicate(major) && major !== secondaryMajor}
                >
                  {major}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton
            onClick={() => setConfirmDeleteSecondary(true)}
            sx={{ ml: 2 }}
          >
            <DeleteIcon />
          </IconButton>
        </Paper>
      ) : (
        <></>
      )}

      <Dialog
        open={confirmDeleteSecondary}
        onClose={() => setConfirmDeleteSecondary(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this Secondary Major?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteSecondary(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              deleteSecondary();
              setConfirmDeleteSecondary(false);
              setShowSecondarySelect(false);
            }}
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default InputSecondaryMajor;
