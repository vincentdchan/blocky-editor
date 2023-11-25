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
import { takeUntil, filter } from "rxjs";
import { get } from "lodash-es";
import "./atPanel.scss";

interface AtPanelProps {
  closeWidget: () => void;
  startOffset: number;
  controller: EditorController;
}

const AtPanel = memo((props: AtPanelProps) => {
  const { startOffset, controller, closeWidget } = props;
  const handleSelect = useCallback(() => {
    const currentCursor = controller.state.cursorState;
    if (!currentCursor?.isCollapsed) {
      return;
    }
    const endIndex = currentCursor.endOffset;
    const deleteLen = Math.max(endIndex - startOffset + 1, 1);
    controller.applyDeltaAtCursor(() =>
      new Delta()
        .retain(Math.max(startOffset - 1, 0))
        .delete(deleteLen)
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
    const content = get(props.record, ["mention"], "");
    this.container.className = "blocky-mention";
    this.container.textContent = "@" + content;
  }
}

export function makeAtPanelPlugin(): IPlugin {
  return {
    name: "at-panel",
    embeds: [MyEmbed],
    onInitialized(context: PluginContext) {
      const { editor, dispose$ } = context;
      editor.keyDown$
        .pipe(
          takeUntil(dispose$),
          filter((e: KeyboardEvent) => e.key === "@")
        )
        .subscribe(() => {
          editor.controller.enqueueNextTick(() => {
            const blockElement = editor.controller.getBlockElementAtCursor();
            if (!blockElement) {
              return;
            }
            if (blockElement.t !== TextBlock.Name) {
              return;
            }
            const currentCursor = editor.controller.state.cursorState;
            if (!currentCursor?.isCollapsed) {
              return;
            }
            const startOffset = currentCursor.startOffset;
            editor.insertFollowerWidget(
              makeReactFollowerWidget(({ controller, closeWidget }) => (
                <AtPanel
                  startOffset={startOffset}
                  controller={controller}
                  closeWidget={closeWidget}
                />
              ))
            );
          });
        });
    },
  };
}
