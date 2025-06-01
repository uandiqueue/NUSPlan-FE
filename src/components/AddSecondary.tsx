import { useMajorStore } from "../store/useMajorStore";
import { useUIStore } from "../store/useUIStore";
import { Button } from "@mui/material";

function AddSecondaryButton() {
  const { primaryMajor } = useMajorStore();
  const { showSecondarySelect, setShowSecondarySelect, setErrorMessage } =
    useUIStore();

  return (
    <Button
      variant="outlined"
      onClick={() => {
        // primaryMajor has not been set yet
        if (!!!primaryMajor) {
          setErrorMessage(
            "Primary major required before adding your Secondary major."
          );
          return;
        }
        if (showSecondarySelect) {
          setErrorMessage("You can select up to 1 Secondary major only.");
          return;
        }
        setShowSecondarySelect(true);
      }}
    >
      Add Secondary Major
    </Button>
  );
}

export default AddSecondaryButton;
