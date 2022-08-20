import { PureComponent } from "preact/compat";
import { Panel, SelectablePanel, PanelItem } from "@pkg/components/panel";
import { type IPlugin, type EditorController, TextBlock } from "blocky-core";
import { makePreactFollowerWidget } from "blocky-preact";
import { Changeset } from "blocky-data";
import Delta from "quill-delta-es";
import "./atPanel.scss";

interface AtPanelProps {
  closeWidget: () => void;
  controller: EditorController;
}

class AtPanel extends PureComponent<AtPanelProps> {
  #handleSelect = () => {
    const { controller } = this.props;
    const element = controller.getBlockElementAtCursor();
    if (!element) {
      return;
    }
    const offset = controller.state.cursorState?.startOffset;
    if (typeof offset === "undefined") {
      return;
    }
    new Changeset(controller.state)
      .textEdit(element, "textContent", () =>
        new Delta()
          .retain(offset - 1)
          .delete(1)
          .insert({
            type: "mention",
            mention: "Vincent Chan",
          })
      )
      .apply();
  };
  #handleClose = () => {
    this.props.closeWidget();
  };
  render(props: AtPanelProps) {
    return (
      <SelectablePanel
        onSelect={this.#handleSelect}
        onClose={this.#handleClose}
        controller={props.controller}
        length={1}
      >
        {(index: number) => (
          <Panel>
            <div className="blocky-commands-container">
              <PanelItem selected={index === 0}>Vincent Chan</PanelItem>
            </div>
          </Panel>
        )}
      </SelectablePanel>
    );
  }
}

export function makeAtPanelPlugin(): IPlugin {
  return {
    name: "at-panel",
    embeds: [
      {
        type: "mention",
        onEmbedCreated(elem) {
          elem.className = "blocky-mention";
          elem.textContent = "@Vincent";
        },
      },
    ],
    onInitialized(editor) {
      editor.keyDown.on((e: KeyboardEvent) => {
        if (e.key !== "@") {
          return;
        }
        const blockElement = editor.controller.getBlockElementAtCursor();
        if (!blockElement) {
          return;
        }
        if (blockElement.nodeName !== TextBlock.Name) {
          return;
        }
        editor.insertFollowerWidget(
          makePreactFollowerWidget(({ controller, closeWidget }) => (
            <AtPanel controller={controller} closeWidget={closeWidget} />
          ))
        );
      });
    },
  };
}
