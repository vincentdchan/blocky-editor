import { memo, useCallback } from "react";
import { makeReactFollowerWidget } from "blocky-react";
import {
  Panel,
  PanelItem,
  PanelValue,
  SelectablePanel,
} from "@pkg/components/panel";
import {
  type EditorController,
  type IPlugin,
  TextBlock,
  type PluginContext,
} from "blocky-core";
import { takeUntil } from "rxjs";

interface CommandPanelProps {
  controller: EditorController;
  editingValue: string;
  closeWidget: () => void;
}

const commandsLength = 1;

const CommandPanel = memo((props: CommandPanelProps) => {
  const { editingValue, closeWidget } = props;

  const handleSelect = useCallback((selectedIndex: number) => {
    if (selectedIndex === 0) {
      alert("Command");
    }
  }, []);

  const handleClose = useCallback(() => {
    closeWidget();
  }, [closeWidget]);

  const commandContent = editingValue;
  return (
    <SelectablePanel
      onSelect={handleSelect}
      onClose={handleClose}
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
});

export function makeCommandPanelPlugin(): IPlugin {
  return {
    name: "command-panel",
    onInitialized(context: PluginContext) {
      const { editor, dispose$ } = context;
      editor.keyDown$
        .pipe(takeUntil(dispose$))
        .subscribe((e: KeyboardEvent) => {
          if (e.key !== "/") {
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
              makeReactFollowerWidget(
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
