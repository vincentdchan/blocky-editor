import React, { Component, PureComponent } from "react";
import { type EditorController } from "blocky-core";
import { Subject, takeUntil } from "rxjs";
import "./panel.scss";

export interface PanelProps {
  children?: any;
}

export class Panel extends Component<PanelProps> {
  render() {
    return (
      <div className="blocky-command-panel-container">{this.props.children}</div>
    );
  }
}

export class PanelValue extends Component<PanelProps> {
  render() {
    return <div className="blocky-command-value">{this.props.children}</div>;
  }
}

interface PanelItemProps {
  selected?: boolean;
  children?: any;
}

export class PanelItem extends PureComponent<PanelItemProps> {
  render() {
    let cls = "blocky-panel-item";
    if (this.props.selected) {
      cls += " selected";
    }
    return <div className={cls}>{this.props.children}</div>;
  }
}

interface SelectablePanelProps {
  controller: EditorController;
  length: number;
  onSelect?: (index: number) => void;
  onClose?: () => void;
  children?: (index: number) => React.ReactNode;
}

interface SelectablePanelState {
  selectedIndex: number;
}

export class SelectablePanel extends Component<
  SelectablePanelProps,
  SelectablePanelState
> {
  private dispose$ = new Subject<void>();
  constructor(props: SelectablePanelProps) {
    super(props);
    this.state = {
      selectedIndex: -1,
    };
  }

  override componentDidMount() {
    const { editor } = this.props.controller;
    if (editor) {
      editor.keyDown
        .pipe(takeUntil(this.dispose$))
        .subscribe(this.#handleEditorKeydown);
    }
  }

  override componentWillUnmount() {
    this.dispose$.next();
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

  render() {
    return this.props.children?.(this.state.selectedIndex);
  }
}
