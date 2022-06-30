import { Component } from "preact";
import { ReactBlockContext } from "../reactBlock";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import { type EditorController, type CursorChangedEvent } from "blocky-core";

interface DefaultBlockOutlineInternalProps {
  editorController: EditorController;
  blockId: string;
  children?: any;
}

interface InternalState {
  showOutline: boolean;
}

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
      editorController.cursorChanged.on(this.handleNewCursorState)
    );
  }

  private handleNewCursorState = (evt: CursorChangedEvent) => {
    const { state } = evt;
    const shouldShowOutline =
      typeof state !== "undefined" &&
      state.type === "collapsed" &&
      state.targetId === this.props.blockId;
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
    editorController.state.cursorState = {
      type: "collapsed",
      targetId: blockId,
      offset: 0,
    };
  };

  override render(
    { children }: DefaultBlockOutlineInternalProps,
    { showOutline }: InternalState
  ) {
    let cls = "blocky-default-block-outline";
    if (showOutline) {
      cls += " outline";
    }
    return (
      <div className={cls} onClick={this.handleContainerClicked}>
        {children}
      </div>
    );
  }
}

export interface DefaultBlockOutlineProps {
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
