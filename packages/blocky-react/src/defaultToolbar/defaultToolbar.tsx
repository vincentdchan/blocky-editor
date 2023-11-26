import { type EditorController, CursorState } from "blocky-core";
import React, { Component, createRef, RefObject, memo } from "react";
import Mask from "@pkg/components/mask";
import { AnchorToolbar } from "./anchorToolbar";
import { toolbarMenuButton, toolbarContainerStyle } from "./style";

const ToolbarMenuItem = memo(
  (props: React.HTMLAttributes<HTMLButtonElement>) => {
    const { className = "", ...restProps } = props;
    return (
      <button
        css={toolbarMenuButton}
        className={`blocky-toolbar-menu-button ${className}`}
        {...restProps}
      />
    );
  }
);

interface ToolbarMenuProps {
  editorController: EditorController;
}

interface ToolbarMenuState {
  showAnchorToolbar: boolean;
  anchorToolbarX: number;
  anchorToolbarY: number;
}

class ToolbarMenu extends Component<ToolbarMenuProps, ToolbarMenuState> {
  private containerRef: RefObject<HTMLDivElement> = createRef();
  private cursorState: CursorState | null = null;

  constructor(props: ToolbarMenuProps) {
    super(props);
    this.state = {
      showAnchorToolbar: false,
      anchorToolbarX: 0,
      anchorToolbarY: 0,
    };
  }

  private handleBold = () => {
    const { editorController } = this.props;
    editorController.formatTextOnSelectedText({
      bold: true,
    });
  };

  private handleItalic = () => {
    const { editorController } = this.props;
    editorController.formatTextOnSelectedText({
      italic: true,
    });
  };

  private handleUnderline = () => {
    const { editorController } = this.props;
    editorController.formatTextOnSelectedText({
      underline: true,
    });
  };

  private handleLinkClicked = () => {
    const { editorController } = this.props;
    // save the cursor state
    this.cursorState = editorController.editor!.state.cursorState;

    const container = this.containerRef.current!;
    const rect = container.getBoundingClientRect();
    this.setState({
      showAnchorToolbar: true,
      anchorToolbarX: rect.x,
      anchorToolbarY: rect.y - 36,
    });
  };

  private handleMaskClicked = () => {
    this.setState({
      showAnchorToolbar: false,
    });
  };

  private handleSubmitLink = (link: string) => {
    this.setState(
      {
        showAnchorToolbar: false,
      },
      () => {
        if (!this.cursorState) {
          return;
        }
        const { editorController } = this.props;
        editorController.formatTextOnCursor(this.cursorState, {
          href: link,
        });
      }
    );
  };

  override render() {
    const { showAnchorToolbar, anchorToolbarX, anchorToolbarY } = this.state;
    return (
      <>
        <div ref={this.containerRef} css={toolbarContainerStyle}>
          <ToolbarMenuItem className="bold rect" onClick={this.handleBold}>
            B
          </ToolbarMenuItem>
          <ToolbarMenuItem className="italic rect" onClick={this.handleItalic}>
            I
          </ToolbarMenuItem>
          <ToolbarMenuItem
            className="underline rect"
            onClick={this.handleUnderline}
          >
            U
          </ToolbarMenuItem>
          <ToolbarMenuItem onClick={this.handleLinkClicked}>
            Link
          </ToolbarMenuItem>
        </div>
        {showAnchorToolbar && (
          <Mask onClick={this.handleMaskClicked}>
            <AnchorToolbar
              onSubmitLink={this.handleSubmitLink}
              style={{
                top: anchorToolbarY + "px",
                left: anchorToolbarX + "px",
              }}
            />
          </Mask>
        )}
      </>
    );
  }
}

export default ToolbarMenu;
