import type { Editor, IPlugin } from "@pkg/index";
import { isHotkey } from "is-hotkey";

function makeCodeTextPlugin(): IPlugin {
  return {
    name: "code-text",
    spans: [
      {
        name: "code",
        className: "blocky-code-text",
      },
    ],
    onInitialized(editor: Editor) {
      editor.keyDown.on((e: KeyboardEvent) => {
        if (isHotkey("mod+m", e)) {
          e.preventDefault();
          editor.controller.formatTextOnSelectedText({
            code: true,
          });
          return;
        }
      });
    },
  };
}

export default makeCodeTextPlugin;
