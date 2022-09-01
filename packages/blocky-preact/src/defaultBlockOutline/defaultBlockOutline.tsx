import { Component, JSX } from "preact";
import { ReactBlockContext } from "../reactBlock";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import { CursorState, type CursorStateUpdateEvent } from "blocky-data";
import type { EditorController, CursorChangedEvent } from "blocky-core";
import { isString } from "lodash-es";

interface DefaultBlockOutlineInternalProps {
  editorController: EditorController;
  blockId: string;
  outlineColor?: string;
  focusOutlineColor?: string;
  children?: any;
}

interface InternalState {
  showOutline: boolean;
  collaborativeOutlineColor?: string;
}

// default color for the outline
const userFocusedColor = `rgb(52, 184, 220)`;

class DefaultBlockOutlineInternal extends Component<
  DefaultBlockOutlineInternalProps,
  InternalState
> {
  private disposables: IDisposable[] = [];

  constructor(props: DefaultBlockOutlineInternalProps) {
    super(props);
    this.state = {
      showOutline: false,
    };
  }

  override componentDidMount() {
    const { editorController } = this.props;
    this.disposables.push(
      editorController.state.cursorStateChanged.on(this.handleNewCursorState)
    );
    this.disposables.push(
      editorController.beforeApplyCursorChanged.on(
        this.handleApplyCursorChangedEvent
      )
    );
  }

  private handleApplyCursorChangedEvent = (evt: CursorChangedEvent) => {
    const { state } = evt;
    const shouldShowOutline =
      state !== null && state.isCollapsed && state.id === this.props.blockId;

    const { editorController } = this.props;
    const { editor } = editorController;
    if (!editor) {
      return;
    }
    if (shouldShowOutline) {
      const cursor = editor.collaborativeCursorManager.getOrInit(evt.id);
      this.setState({
        collaborativeOutlineColor: cursor.client.color,
      });
    } else {
      this.setState({
        collaborativeOutlineColor: undefined,
      });
    }
  };

  private handleNewCursorState = (evt: CursorStateUpdateEvent) => {
    const { state } = evt;
    const shouldShowOutline =
      state !== null && state.isCollapsed && state.id === this.props.blockId;
    if (shouldShowOutline === this.state.showOutline) {
      return;
    }

    this.setState({
      showOutline: shouldShowOutline,
    });
  };

  override componentWillUnmount() {
    flattenDisposable(this.disposables).dispose();
  }

  private handleContainerClicked = () => {
    const { editorController, blockId } = this.props;
    editorController.setCursorState(CursorState.collapse(blockId, 0));
  };

  override render(
    {
      children,
      outlineColor,
      focusOutlineColor,
    }: DefaultBlockOutlineInternalProps,
    { showOutline, collaborativeOutlineColor }: InternalState
  ) {
    let style: JSX.CSSProperties | undefined;
    if (showOutline) {
      style = {
        boxShadow: `0 0 0 1pt ${focusOutlineColor ?? userFocusedColor}`,
      };
    } else if (typeof collaborativeOutlineColor === "string") {
      style = {
        boxShadow: `0 0 0 1pt ${collaborativeOutlineColor}`,
      };
    } else if (isString(outlineColor)) {
      style = {
        boxShadow: `0 0 0 1pt ${outlineColor}`,
      };
    }
    return (
      <div
        className="blocky-default-block-outline"
        style={style}
        onClick={this.handleContainerClicked}
      >
        {children}
      </div>
    );
  }
}

export interface DefaultBlockOutlineProps {
  outlineColor?: string;
  focusOutlineColor?: string;
  children?: any;
}

export function DefaultBlockOutline(props: DefaultBlockOutlineProps) {
  return (
    <ReactBlockContext.Consumer>
      {(ctx) => (
        <DefaultBlockOutlineInternal
          editorController={ctx!.editorController}
          blockId={ctx!.blockId}
          {...props}
        />
      )}
    </ReactBlockContext.Consumer>
  );
}
