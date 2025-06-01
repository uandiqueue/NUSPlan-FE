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

function InputMinor() {
  const { majorList, minors, addMinor, updateMinor, deleteMinor, isDuplicate } =
    useMajorStore();

  const { confirmDeleteId, setConfirmDeleteId } = useUIStore();

  const handleSelectMinor = (e: SelectChangeEvent, id: number) => {
    updateMinor(id, e.target.value);
  };

  return (
    <>
      {minors.map((entry) => (
        <Paper
          key={entry.id}
          sx={{ p: 2, mb: 2, display: "flex", alignItems: "center" }}
        >
          <FormControl fullWidth>
            <InputLabel>Select Minor</InputLabel>
            <Select
              value={entry.value}
              label="Select Minor"
              onChange={(e) => handleSelectMinor(e, entry.id)}
            >
              {majorList.map((major) => (
                <MenuItem
                  key={major}
                  value={major}
                  disabled={isDuplicate(major) && major !== entry.value}
                >
                  {major}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton
            onClick={() => setConfirmDeleteId(entry.id)}
            sx={{ ml: 2 }}
          >
            <DeleteIcon />
          </IconButton>
        </Paper>
      ))}
      <Dialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this Minor?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (confirmDeleteId !== null) deleteMinor(confirmDeleteId);
              setConfirmDeleteId(null);
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

export default InputMinor;
