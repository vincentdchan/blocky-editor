import type { IPlugin } from "@pkg/registry/pluginRegistry";
import { SpanType } from "@pkg/registry/spanRegistry";
import { type TreeNode, type DocNode, type BlockData } from "@pkg/model";
import type { Editor } from "@pkg/view/editor";
import { type Action } from "@pkg/model/actions";
import { isHotkey } from "is-hotkey";

const SpanName = "bold";

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
  const makeTextBlockRangeBolded = (
    editor: Editor,
    blockNode: TreeNode<DocNode>,
    startOffset: number,
    endOffset: number
  ) => {
    if (startOffset === endOffset) {
      return;
    }

    const block = blockNode.data as BlockData;

    const actions: Action[] = [
      {
        type: "text-format",
        targetId: block.id,
        index: startOffset,
        length: endOffset - startOffset,
        attributes: {
          bold: true
        },
      },
    ];

    editor.applyActions(actions);
    editor.render();
  };
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
      makeTextBlockRangeBolded(editor, blockNode, startOffset, endOffset);
    } else {
      console.log("unimplemented bold");
    }
  };
  return {
    name: "bolded-text",
    onInitialized(editor: Editor) {
      editor.registry.span.register({
        name: SpanName,
        type: SpanType.StyledText,
        classNames: ["mg-editor-bold"],
      });
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
