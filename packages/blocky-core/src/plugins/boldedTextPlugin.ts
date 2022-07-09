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
function makeBoldedTextPlugin(): IPlugin {
  return {
    name: "bolded-text",
    onInitialized(editor: Editor) {
      editor.registry.span.register({
        name: "bold",
        className: "mg-editor-bold",
      });
      editor.keyDown.on((e: KeyboardEvent) => {
        if (isHotkey("mod+b", e)) {
          e.preventDefault();
          editor.controller.formatTextOnSelectedText({
            bold: true
          });
          return;
        }
      });
    },
  };
}

export default makeBoldedTextPlugin;
