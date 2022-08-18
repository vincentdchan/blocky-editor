import { Component, ComponentChildren } from "preact";
import { PureComponent } from "preact/compat";
import { type EditorController } from "blocky-core";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import "./panel.scss";

export interface PanelProps {
  children?: any;
}

export class Panel extends Component<PanelProps> {
  render(props: PanelProps) {
    return (
      <div className="blocky-command-panel-container">{props.children}</div>
    );
  }
}

export class PanelValue extends Component<PanelProps> {
  render(props: PanelProps) {
    return <div className="blocky-command-value">{props.children}</div>;
  }
}

interface PanelItemProps {
  selected?: boolean;
  children?: any;
}

export class PanelItem extends PureComponent<PanelItemProps> {
  render(props: PanelItemProps) {
    let cls = "blocky-panel-item";
    if (props.selected) {
      cls += " selected";
    }
    return <div className={cls}>{props.children}</div>;
  }
}

interface SelectablePanelProps {
  controller: EditorController;
  length: number;
  onSelect?: (index: number) => void;
  onClose?: () => void;
  children?: (index: number) => ComponentChildren;
}

interface SelectablePanelState {
  selectedIndex: number;
}

export class SelectablePanel extends Component<
  SelectablePanelProps,
  SelectablePanelState
> {
  private disposables: IDisposable[] = [];
  constructor(props: SelectablePanelProps) {
    super(props);
    this.state = {
      selectedIndex: -1,
    };
  }
  override componentDidMount() {
    const { editor } = this.props.controller;
    if (editor) {
      this.disposables.push(editor.keyDown.on(this.#handleEditorKeydown));
    }
  }
  override componentWillUnmount() {
    flattenDisposable(this.disposables).dispose();
  }
  #handleEditorKeydown = (e: KeyboardEvent) => {
    const commandsLength = this.props.length;
    let currentIndex = this.state.selectedIndex;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentIndex++;
      if (++currentIndex >= commandsLength) {
        currentIndex = 0;
      }
      this.setState({
        selectedIndex: currentIndex,
      });
      return;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (--currentIndex < 0) {
        currentIndex = commandsLength - 1;
      }
      this.setState({
        selectedIndex: currentIndex,
      });
      return;
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.props.onSelect?.(currentIndex);
      this.props.onClose?.();
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.props.onClose?.();
      return;
    }
  };
  render(props: SelectablePanelProps) {
    return props.children?.(this.state.selectedIndex);
  }
}
