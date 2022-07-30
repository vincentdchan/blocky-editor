import { ComponentChild } from "preact";
import { PureComponent } from "preact/compat";
import { makePreactFollowWidget } from "blocky-preact";
import { TextBlockName, type IPlugin } from "blocky-core";
import "./commandPanel.scss";

interface CommandPanelProps {
  editingValue: string;
}

interface CommandItemProps {
  children?: any;
}

class CommandItem extends PureComponent<CommandItemProps> {
  render(props: CommandItemProps): ComponentChild {
    return <div className="blocky-command-item">{props.children}</div>;
  }
}

class CommandPanel extends PureComponent<CommandPanelProps> {
  render(props: CommandPanelProps): ComponentChild {
    const { editingValue } = props;
    const commandContent = editingValue.slice(1);
    return (
      <div className="blocky-command-panel-container">
        <div className="blocky-command-value">
          Command: {commandContent.length === 0 ? "Empty" : commandContent}
        </div>
        <div className="blocky-commands-container">
          <CommandItem>Checkbox</CommandItem>
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
          makePreactFollowWidget(({ editingValue }) => (
            <CommandPanel editingValue={editingValue} />
          ))
        );
      });
    },
  };
}
