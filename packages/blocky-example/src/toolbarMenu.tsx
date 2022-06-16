import { type EditorController } from "blocky-core";
import { Component, JSX } from "preact";
import { memo } from "preact/compat";
import "./toolbarMenu.scss";

const ToolbarMenuItem = memo((props: JSX.HTMLAttributes<HTMLButtonElement>) => {
  const { className = "", ...restProps } = props;
  return (
    <button
      className={`blocky-toolbar-menu-button ${className}`}
      {...restProps}
    />
  );
});

interface ToolbarMenuProps {
  editorController: EditorController;
}

interface ToolbarMenuState {
  showAnchorToolbar: boolean;
}

class ToolbarMenu extends Component<ToolbarMenuProps, ToolbarMenuState> {

  constructor(props: ToolbarMenuProps) {
    super(props);
    this.state = {
      showAnchorToolbar: false,
    };
  }

  private handleBold = () => {
    const { editorController } = this.props;
    editorController.formatTextOnSelectedText({
      bold: true
    });
  };

  private handleItalic = () => {
    const { editorController } = this.props;
    editorController.formatTextOnSelectedText({
      italic: true
    });
  };

  private handleLinkClicked = () => {
    this.setState({
      showAnchorToolbar: true,
    });
  };

  override render() {
    return (
      <div className="blocky-example-toolbar-container">
        <ToolbarMenuItem className="bold rect" onClick={this.handleBold}>
          B
        </ToolbarMenuItem>
        <ToolbarMenuItem className="italic rect" onClick={this.handleItalic}>
          I
        </ToolbarMenuItem>
        <ToolbarMenuItem onClick={this.handleLinkClicked}>Link</ToolbarMenuItem>
      </div>
    );
  }
}

export default ToolbarMenu;
