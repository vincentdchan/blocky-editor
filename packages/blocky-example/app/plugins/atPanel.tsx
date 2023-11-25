import { memo, useCallback } from "react";
import { Panel, SelectablePanel, PanelItem } from "@pkg/components/panel";
import {
  type IPlugin,
  type EditorController,
  TextBlock,
  Embed,
  type EmbedInitOptions,
  type PluginContext,
  Delta,
} from "blocky-core";
import { makeReactFollowerWidget } from "blocky-react";
import { takeUntil } from "rxjs";
import "./atPanel.scss";

interface AtPanelProps {
  closeWidget: () => void;
  controller: EditorController;
}

const AtPanel = memo((props: AtPanelProps) => {
  const { controller, closeWidget } = props;
  const handleSelect = useCallback(() => {
    controller.applyDeltaAtCursor((index) =>
      new Delta()
        .retain(Math.max(index - 1, 0))
        .delete(1)
        .insert({
          type: "mention",
          mention: "Vincent Chan",
        })
    );
  }, [controller]);

  const handleClose = useCallback(() => {
    closeWidget();
  }, [closeWidget]);

  return (
    <SelectablePanel
      onSelect={handleSelect}
      onClose={handleClose}
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
});

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
    onInitialized(context: PluginContext) {
      const { editor, dispose$ } = context;
      editor.keyDown$
        .pipe(takeUntil(dispose$))
        .subscribe((e: KeyboardEvent) => {
          if (e.key !== "@") {
            return;
          }
          editor.controller.enqueueNextTick(() => {
            const blockElement = editor.controller.getBlockElementAtCursor();
            if (!blockElement) {
              return;
            }
            if (blockElement.t !== TextBlock.Name) {
              return;
            }
            editor.insertFollowerWidget(
              makeReactFollowerWidget(({ controller, closeWidget }) => (
                <AtPanel controller={controller} closeWidget={closeWidget} />
              ))
            );
          });
        });
    },
  };
}
