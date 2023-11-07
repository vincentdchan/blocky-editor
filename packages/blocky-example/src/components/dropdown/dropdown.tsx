import { Component } from "react";
import { createPortal } from "react-dom";
import Mask from "@pkg/components/mask";

export interface DropdownProps {
  show?: boolean;
  onMaskClicked?: () => void;
  overlay?: any;
  children?: any;
}

class Dropdown extends Component<DropdownProps> {

  override render() {
    const { children, show, onMaskClicked, overlay } = this.props;
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
