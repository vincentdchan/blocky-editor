import { useCallback, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import type LoroPlugin from "./loroPlugin";
import styles from "./loroBlock.module.scss";

export interface LoroBlockProps {
  plugin: LoroPlugin;
  onWipe?: () => void;
}

const background = `<svg width="300" height="300" viewBox="0 0 361 366" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M245.712 62.7851L114.974 302.197C52.431 264.754 30.1208 184.253 65.369 119.706C100.617 55.1581 180.402 30.4094 245.712 62.7851Z" fill="#85DFED"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M115 302.411L245.738 63C308.281 100.442 330.591 180.943 295.343 245.491C260.095 310.038 180.31 334.787 115 302.411Z" fill="#6B218E"></path>
</svg>`;

function LoroBlock(props: LoroBlockProps) {
  const { onWipe } = props;
  const [open, setOpen] = useState(false);
  const handleOpenNewTab = useCallback(() => {
    // open the same url in new tab
    window.open(window.location.href, "_blank");
  }, []);
  const handleClickOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  const handleConfirm = useCallback(() => {
    setOpen(false);
    onWipe?.();
  }, [onWipe]);
  return (
    <>
      <div className={styles.container}>
        <a className={styles.icon} href="https://loro.dev/">
          <img src="/LORO.svg" alt="" />
        </a>
        <div className={styles.buttons}>
          <Button
            variant="contained"
            sx={{ textTransform: "none" }}
            onClick={handleOpenNewTab}
          >
            Collaborate in new Tab
          </Button>
          <Button
            variant="contained"
            sx={{ textTransform: "none" }}
            color="error"
            onClick={handleClickOpen}
          >
            Wipe all data and Refresh
          </Button>
          {/* <Button variant="contained" sx={{ textTransform: "none" }}>
          Save content
        </Button> */}
        </div>
        <div
          className={styles.blur}
          dangerouslySetInnerHTML={{ __html: background }}
        ></div>
      </div>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Wipe all data?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure to wipe all data? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleConfirm} color="error" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default LoroBlock;
