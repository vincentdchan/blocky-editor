import { Component } from "preact";
import "./mask.scss";

export interface MaskProps {
  children?: any;
  onClick?: () => void;
}

class Mask extends Component<MaskProps> {

  override render({ children, onClick }: MaskProps) {
    return (
      <div className="blocky-example-mask" onClick={onClick}>
        {children}
      </div>
    );
  }

}

export default Mask;
