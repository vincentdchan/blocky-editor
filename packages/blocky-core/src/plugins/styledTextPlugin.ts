import type { Editor, IPlugin } from "@pkg/index";
import { isHotkey } from "is-hotkey";

/**
 * This plugin is used to make the editor support bolded text.
 *
 * The bolded text will be wrapped in as `<span>` element.
 * So the plugin register the span in the editor's `SpanRegistry`.
 *
 * After all, this plugin handles the hotkey to make selected text bolded.
 *
 */
function makeStyledTextPlugin(): IPlugin {
  return {
    name: "bolded-text",
    spans: [
      {
        name: "bold",
        className: "blocky-bold-text",
      },
      {
        name: "italic",
        className: "blocky-italic-text",
      },
      {
        name: "underline",
        onSpanCreated(elem: HTMLElement) {
          elem.style.textDecoration = "underline";
        },
      },
    ],
    onInitialized(editor: Editor) {
      editor.keyDown.on((e: KeyboardEvent) => {
        if (isHotkey("mod+b", e)) {
          e.preventDefault();
          editor.controller.formatTextOnSelectedText({
            bold: true,
          });
        } else if (isHotkey("mod+i", e)) {
          e.preventDefault();
          editor.controller.formatTextOnSelectedText({
            italic: true,
          });
        } else if (isHotkey("mod+u", e)) {
          e.preventDefault();
          editor.controller.formatTextOnSelectedText({
            underline: true,
          });
        }
      });
    },
  };
}

export default makeStyledTextPlugin;
