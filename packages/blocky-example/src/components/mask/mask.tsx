import { Component } from "react";
import "./mask.scss";

export interface MaskProps {
  children?: any;
  onClick?: () => void;
}

class Mask extends Component<MaskProps> {

  override render() {
    const { children, onClick } = this.props;
    return (
      <div className="blocky-example-mask" onClick={onClick}>
        {children}
      </div>
    );
  }

}

export default Mask;
