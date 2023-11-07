import { PureComponent } from "react";
import { Panel, SelectablePanel, PanelItem } from "@pkg/components/panel";
import {
  type IPlugin,
  type EditorController,
  TextBlock,
  Embed,
  type EmbedInitOptions,
} from "blocky-core";
import { makePreactFollowerWidget } from "blocky-react";
import { Delta } from "blocky-data";
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

  override render() {
    return (
      <SelectablePanel
        onSelect={this.#handleSelect}
        onClose={this.#handleClose}
        controller={this.props.controller}
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

class MyEmbed extends Embed {
  static type = "mention";

  constructor(props: EmbedInitOptions) {
    super(props);
    this.container.className = "blocky-mention";
    this.container.textContent = "@Vincent";
  }

  dispose() {
    console.log("delete mention");
  }
}

export function makeAtPanelPlugin(): IPlugin {
  return {
    name: "at-panel",
    embeds: [MyEmbed],
    onInitialized(editor) {
      editor.keyDown.subscribe((e: KeyboardEvent) => {
        if (e.key !== "@") {
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
            makePreactFollowerWidget(({ controller, closeWidget }) => (
              <AtPanel controller={controller} closeWidget={closeWidget} />
            ))
          );
        });
      });
    },
  };
}
