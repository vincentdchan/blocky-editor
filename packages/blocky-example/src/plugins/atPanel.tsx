import { PureComponent } from "preact/compat";
import { Panel, SelectablePanel, PanelItem } from "@pkg/components/panel";
import { type IPlugin, type EditorController, TextBlock } from "blocky-core";
import { makePreactFollowerWidget } from "blocky-preact";
import Delta from "quill-delta-es";
import "./atPanel.scss";

interface AtPanelProps {
  closeWidget: () => void;
  controller: EditorController;
}

class AtPanel extends PureComponent<AtPanelProps> {
  #handleSelect = () => {
    this.props.controller.applyDeltaAtCursor((index) =>
      new Delta()
        .retain(Math.max(index - 1, 0))
        .delete(1)
        .insert({
          type: "mention",
          mention: "Vincent Chan",
        })
    );
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
