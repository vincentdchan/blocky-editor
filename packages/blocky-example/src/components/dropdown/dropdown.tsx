import { Component } from "preact";
import { createPortal } from "preact/compat";
import Mask from "@pkg/components/mask";

export interface DropdownProps {
  show?: boolean;
  children: any;
}

class Dropdown extends Component<DropdownProps> {

  override render(props: DropdownProps) {
    const { children, show } = props;
    return (
      <>
        {children}
        {show && (
          createPortal(<Mask />, document.body)
        )}
      </>
    );
  }

}

export default Dropdown;
