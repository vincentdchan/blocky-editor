import type { IPlugin } from "@pkg/registry/pluginRegistry";
import type { Editor } from "@pkg/view/editor";
import { isHotkey } from "is-hotkey";
import { AttributesObject } from "@pkg/model/textModel";

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
  const makeBold = (editor: Editor) => {
    const { cursorState } = editor.state;
    if (!cursorState) {
      return;
    }

    if (cursorState.type === "collapsed") {
      return;
    }

    const { startId, endId, startOffset, endOffset } = cursorState;

    if (startId === endId) {
      // make a single fragment bolded
      const blockNode = editor.state.idMap.get(startId);
      if (!blockNode) {
        console.error(`${startId} not found`);
        return;
      }
      if (blockNode.data.t !== "block") {
        console.error(`${startId} is not a block`);
        return;
      }
      editor.controller.formatText(
        blockNode.data.id,
        startOffset,
        endOffset - startOffset,
        {
          bold: true,
        }
      );
    } else {
      console.log("unimplemented bold");
    }
  };
  return {
    name: "bolded-text",
    onInitialized(editor: Editor) {
      editor.registry.span.on(
        (element: HTMLSpanElement, attribs: AttributesObject) => {
          if (attribs.bold === true) {
            element.classList.add("mg-editor-bold");
          }
        }
      );
      editor.keyDown.on((e: KeyboardEvent) => {
        if (isHotkey("mod+b", e)) {
          e.preventDefault();
          makeBold(editor);
          return;
        }
      });
    },
  };
}

export default makeBoldedTextPlugin;
