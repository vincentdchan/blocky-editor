import type { ComponentChild } from "preact";
import { PureComponent } from "preact/compat";
import { makePreactFollowerWidget } from "blocky-preact";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import {
  Panel,
  PanelItem,
  PanelValue,
  SelectablePanel,
} from "@pkg/components/panel";
import { type EditorController, type IPlugin, TextBlock } from "blocky-core";

interface CommandPanelProps {
  controller: EditorController;
  editingValue: string;
  closeWidget: () => void;
}

const commandsLength = 1;

class CommandPanel extends PureComponent<CommandPanelProps> {
  private disposables: IDisposable[] = [];
  constructor(props: CommandPanelProps) {
    super(props);
  }

  #handleSelect = (selectedIndex: number) => {
    if (selectedIndex === 0) {
      alert("Command");
    }
  };

  #handleClose = () => {
    this.props.closeWidget();
  };

  override componentWillUnmount() {
    flattenDisposable(this.disposables).dispose();
  }

  render(props: CommandPanelProps): ComponentChild {
    const { editingValue } = props;
    const commandContent = editingValue;
    return (
      <SelectablePanel
        onSelect={this.#handleSelect}
        onClose={this.#handleClose}
        controller={props.controller}
        length={commandsLength}
      >
        {(index: number) => (
          <Panel>
            <PanelValue>
              Command: {commandContent.length === 0 ? "Empty" : commandContent}
            </PanelValue>
            <div className="blocky-commands-container">
              <PanelItem selected={index === 0}>Alert</PanelItem>
            </div>
          </Panel>
        )}
      </SelectablePanel>
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

        editor.controller.enqueueNextTick(() => {
          const blockElement = editor.controller.getBlockElementAtCursor();
          if (!blockElement) {
            return;
          }
          if (blockElement.nodeName !== TextBlock.Name) {
            return;
          }
          editor.insertFollowerWidget(
            makePreactFollowerWidget(
              ({ controller, editingValue, closeWidget }) => (
                <CommandPanel
                  controller={controller}
                  editingValue={editingValue}
                  closeWidget={closeWidget}
                />
              ),
              { maxHeight: 80 }
            )
          );
        });
      });
    },
  };
}
