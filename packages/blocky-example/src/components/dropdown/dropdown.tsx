import { Component } from "preact";
import { createPortal } from "preact/compat";
import Mask from "@pkg/components/mask";

export interface DropdownProps {
  show?: boolean;
  onMaskClicked?: () => void;
  overlay?: any;
  children?: any;
}

class Dropdown extends Component<DropdownProps> {

  override render(props: DropdownProps) {
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
}

export default Dropdown;
