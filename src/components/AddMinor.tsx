import { useMajorStore } from "../store/useProgrammeStore";
import { useUIStore } from "../store/useUIStore";
import { Button } from "@mui/material";

function AddMinor() {
  const { primaryMajor, minors, addMinor } = useMajorStore();
  const { setErrorMessage } = useUIStore();

  return (
    <Button
      variant="outlined"
      onClick={() => {
        if (!!!primaryMajor) {
          setErrorMessage("Primary major required before adding minors.");
          return;
        }
        if (minors.length === 3) {
          setErrorMessage("You can select up to 3 minors only.");
          return;
        }
        addMinor();
      }}
    >
      Add Minor
    </Button>
  );
}

export default AddMinor;
