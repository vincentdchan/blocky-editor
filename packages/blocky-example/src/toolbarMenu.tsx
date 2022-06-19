import { CursorState, type EditorController } from "blocky-core";
import { Component, JSX, createRef, RefObject } from "preact";
import { memo } from "preact/compat";
import Mask from "@pkg/components/mask";
import Button from "./components/button";
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
  anchorToolbarX: number;
  anchorToolbarY: number;
}

class ToolbarMenu extends Component<ToolbarMenuProps, ToolbarMenuState> {
  #containerRef: RefObject<HTMLDivElement> = createRef();
  #cursorState: CursorState | undefined;

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

  private handleLinkClicked = () => {
    const { editorController } = this.props;
    // save the cursor state
    this.#cursorState = editorController.editor?.state.cursorState;

    const container = this.#containerRef.current!;
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
        if (!this.#cursorState) {
          return;
        }
        const { editorController } = this.props;
        editorController.formatTextOnCursor(this.#cursorState, {
          href: link,
        });
      }
    );
  };

  override render() {
    const { showAnchorToolbar, anchorToolbarX, anchorToolbarY } = this.state;
    return (
      <>
        <div
          ref={this.#containerRef}
          className="blocky-example-toolbar-container"
        >
          <ToolbarMenuItem className="bold rect" onClick={this.handleBold}>
            B
          </ToolbarMenuItem>
          {/* <ToolbarMenuItem className="italic rect" onClick={this.handleItalic}>
            I
          </ToolbarMenuItem> */}
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
  style?: JSX.CSSProperties;
  onSubmitLink?: (link: string) => void;
}

interface AnchorToolbarState {
  content: string;
}

class AnchorToolbar extends Component<AnchorToolbarProps, AnchorToolbarState> {
  #inputRef: RefObject<HTMLInputElement> = createRef();

  constructor(props: AnchorToolbarProps) {
    super(props);
    this.state = {
      content: "",
    };
  }

  private handleClicked = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  private handleConfirmed = () => {
    this.props.onSubmitLink?.(this.state.content);
  };

  private handleContentChanged = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    this.setState({
      content: (e.target! as any).value,
    });
  };

  override componentDidMount() {
    this.#inputRef.current?.focus();
  }

  override render(props: AnchorToolbarProps, state: AnchorToolbarState) {
    const { style } = props;
    return (
      <div
        onClick={this.handleClicked}
        style={style}
        className="blocky-example-toolbar-container blocky-example-anchor-toolbar"
      >
        <input
          ref={this.#inputRef}
          placeholder="Link"
          value={state.content}
          onChange={this.handleContentChanged}
        />
        <Button onClick={this.handleConfirmed}>Confirm</Button>
      </div>
    );
  }
}

export default ToolbarMenu;
