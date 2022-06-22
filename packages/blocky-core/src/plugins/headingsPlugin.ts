import type { IPlugin } from "@pkg/registry/pluginRegistry";
import { isWhiteSpace } from "blocky-common/es/text";
import type { Editor } from "@pkg/view/editor";
import type { Block } from "@pkg/block/basic";
import {
  type IModelElement,
  TextModel,
  TextType,
  type TextInsertEvent,
  setTextType,
} from "@pkg/model";

function makeHeadingsPlugin(): IPlugin {
  const handleNewBlockCreated = (editor: Editor) => (block: Block) => {
    const blockData = block.props.data as IModelElement | undefined;
    if (!blockData) {
      return;
    }

    const type = blockData.getAttribute("type");

    if (type !== "text") {
      return;
    }

    const textModel = blockData.firstChild! as TextModel;

    textModel.onInsert.on((e: TextInsertEvent) => {
      let changed: boolean = false;
      const { index, text } = e;
      if (isWhiteSpace(text)) {
        const content = textModel.toString();
        const before = content.slice(0, index);
        if (before === "#") {
          textModel.delete(0, 2);
          changed = true;
          setTextType(blockData, TextType.Heading1);
        } else if (before === "##") {
          textModel.delete(0, 3);
          changed = true;
          setTextType(blockData, TextType.Heading2);
        } else if (before === "###") {
          textModel.delete(0, 4);
          changed = true;
          setTextType(blockData, TextType.Heading3);
        }
      }

      if (changed) {
        editor.render(() => {
          editor.state.cursorState = {
            type: "collapsed",
            targetId: block.props.id,
            offset: 0,
          };
        });
      }
    });
  };
  return {
    name: "headings",
    onInitialized(editor: Editor) {
      editor.state.newBlockCreated.on(handleNewBlockCreated(editor));
    },
  };
}

export default makeHeadingsPlugin;
