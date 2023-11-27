import { createPortal } from "react-dom";
import Mask from "@pkg/components/mask";

export interface DropdownProps {
  show?: boolean;
  onMaskClicked?: () => void;
  overlay?: any;
  children?: any;
}

function Dropdown(props: DropdownProps) {
  const { children, show, onMaskClicked, overlay } = props;
  return (
    <>
      {children}
      {show &&
        createPortal(
          <Mask onClick={onMaskClicked}>{overlay}</Mask>,
          document.body
        )}
    </>
  );
}

export default Dropdown;
