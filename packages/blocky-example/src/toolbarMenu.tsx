import { Component, JSX } from "preact";
import { memo } from "preact/compat";
import "./toolbarMenu.scss";

const ToolbarMenuItem = memo((props: JSX.HTMLAttributes<HTMLButtonElement>) => {
  const { className = "", ...restProps } = props;
  return (<button className={`blocky-toolbar-menu-button ${className}`} {...restProps} />);
});

class ToolbarMenu extends Component {

  override render() {
    return (
      <div className="blocky-example-toolbar-container">
        <ToolbarMenuItem className="bold">B</ToolbarMenuItem>
        <ToolbarMenuItem className="italic">I</ToolbarMenuItem>
      </div>
    );
  }

}

export default ToolbarMenu;
