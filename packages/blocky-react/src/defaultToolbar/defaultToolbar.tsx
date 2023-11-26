import { type EditorController, CursorState } from "blocky-core";
import React, { Component, createRef, RefObject, memo } from "react";
import Mask from "@pkg/components/mask";
import Button from "@pkg/components/button";
import { css } from "@emotion/react";

const toolbarContainerStyle = css({
  backgroundColor: "var(--bg-color)",
  boxShadow: "0px 0px 4px rgba(0, 0, 0, 0.2)",
  padding: 0,
  borderRadius: 4,
  overflow: "hidden",
  boxSizing: "border-box",
});

const toolbarMenuButton = css({
  backgroundColor: "var(--bg-color)",
  color: "var(--primary-text-color)",
  border: "none",
  margin: 0,
  height: 24,
  "&.rect": {
    width: 24,
  },
  "&:hover": {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  "&.bold": {
    fontFamily: `'Times New Roman', Times, serif`,
    fontWeight: 600,
  },
  "&.italic": {
    fontFamily: `'Times New Roman', Times, serif`,
    fontStyle: "italic",
  },
  "&.underline": {
    fontFamily: `'Times New Roman', Times, serif`,
    textDecoration: "underline",
  },
});

const anchorToolbarStyle = css(toolbarContainerStyle, {
  position: "fixed",
  padding: "4px 8px",
  input: {
    border: "none",
    marginRight: 8,
    "&:focus": {
      outline: "none",
    },
  },
  button: {
    fontSize: 12,
    padding: "2px 4px",
  },
});

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

interface AnchorToolbarProps {
  style?: React.CSSProperties;
  onSubmitLink?: (link: string) => void;
}

interface AnchorToolbarState {
  content: string;
  valid: boolean;
}

function isUrl(text: string): boolean {
  try {
    const url = new URL(text);
    const { protocol } = url;
    return protocol === "http:" || protocol === "https:";
  } catch (e) {
    return false;
  }
}

class AnchorToolbar extends Component<AnchorToolbarProps, AnchorToolbarState> {
  private inputRef: RefObject<HTMLInputElement> = createRef();

  constructor(props: AnchorToolbarProps) {
    super(props);
    this.state = {
      content: "",
      valid: false,
    };
  }

  private handleClicked = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  private handleConfirmed = () => {
    this.props.onSubmitLink?.(this.state.content);
  };

  private handleContentChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const content = (e.target! as any).value as string;
    const valid = isUrl(content);
    this.setState({
      content,
      valid,
    });
  };

  private handleKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!this.state.valid) {
        return;
      }
      this.handleConfirmed();
    }
  };

  override componentDidMount() {
    this.inputRef.current?.focus();
  }

  override render() {
    const { style } = this.props;
    return (
      <div
        onClick={this.handleClicked}
        style={style}
        css={anchorToolbarStyle}
        className="blocky-example-toolbar-container"
      >
        <input
          ref={this.inputRef}
          placeholder="Link"
          value={this.state.content}
          onChange={this.handleContentChanged}
          onKeyDown={this.handleKeydown}
        />
        <Button disabled={!this.state.valid} onClick={this.handleConfirmed}>
          Confirm
        </Button>
      </div>
    );
  }
}

export default ToolbarMenu;
