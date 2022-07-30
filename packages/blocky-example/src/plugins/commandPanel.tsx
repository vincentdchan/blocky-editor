import { ComponentChild } from "preact";
import { PureComponent } from "preact/compat";
import { makePreactFollowWidget } from "blocky-preact";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import {
  type EditorController,
  type IPlugin,
  TextBlockName,
} from "blocky-core";
import "./commandPanel.scss";

interface CommandItemProps {
  selected?: boolean;
  children?: any;
}

class CommandItem extends PureComponent<CommandItemProps> {
  render(props: CommandItemProps): ComponentChild {
    let cls = "blocky-command-item";
    if (props.selected) {
      cls += " selected";
    }
    return <div className={cls}>{props.children}</div>;
  }
}

interface CommandPanelProps {
  controller: EditorController;
  editingValue: string;
  closeWidget: () => void;
}

interface CommandPanelState {
  selectedIndex: number;
}

const commandsLength = 1;

class CommandPanel extends PureComponent<CommandPanelProps, CommandPanelState> {
  private disposables: IDisposable[] = [];
  constructor(props: CommandPanelProps) {
    super(props);
    this.state = {
      selectedIndex: -1,
    };
  }
  override componentDidMount() {
    this.disposables.push(
      this.props.controller.editor!.keyDown.on(this.#handleEditorKeydown)
    );
  }
  #handleEditorKeydown = (e: KeyboardEvent) => {
    let currentIndex = this.state.selectedIndex;
    console.log(e.key);
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
      // TODO: confirm
      return;
    }
  };
  override componentWillUnmount() {
    flattenDisposable(this.disposables).dispose();
  }
  render(props: CommandPanelProps, state: CommandPanelState): ComponentChild {
    const { editingValue } = props;
    const { selectedIndex } = state;
    const commandContent = editingValue.slice(1);
    return (
      <div className="blocky-command-panel-container">
        <div className="blocky-command-value">
          Command: {commandContent.length === 0 ? "Empty" : commandContent}
        </div>
        <div className="blocky-commands-container">
          <CommandItem selected={selectedIndex === 0}>Checkbox</CommandItem>
        </div>
      </div>
    );
  }
}

export function makeCommandPanelPlugin(): IPlugin {
  return {
    name: "command-panel",
    onInitialized(editor) {
      editor.keyDown.on((e: KeyboardEvent) => {
        if (e.key !== "/") {
          return;
        }
        const blockElement = editor.controller.getBlockElementAtCursor();
        if (!blockElement) {
          return;
        }
        if (blockElement.nodeName !== TextBlockName) {
          return;
        }
        editor.insertFollowWidget(
          makePreactFollowWidget(
            ({ controller, editingValue, closeWidget }) => (
              <CommandPanel
                controller={controller}
                editingValue={editingValue}
                closeWidget={closeWidget}
              />
            )
          )
        );
      });
    },
  };
}
