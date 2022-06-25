import type { IPlugin } from "@pkg/registry/pluginRegistry";
import { isWhiteSpace } from "blocky-common/es/text";
import type { Editor } from "@pkg/view/editor";
import type { Block } from "@pkg/block/basic";
import { setTextTypeForTextBlock } from "@pkg/block/textBlock";
import { BlockyTextModel, TextType, type TextInsertEvent } from "@pkg/model";

function makeHeadingsPlugin(): IPlugin {
  const handleNewBlockCreated = (editor: Editor) => (block: Block) => {
    const blockElement = block.props;

    if (blockElement.blockName !== "text") {
      return;
    }

    const blockContent = blockElement.contentContainer;
    const textModel = blockContent.firstChild as BlockyTextModel;

    textModel.onInsert.on((e: TextInsertEvent) => {
      let changed: boolean = false;
      const { index, text } = e;
      if (isWhiteSpace(text)) {
        const content = textModel.toString();
        const before = content.slice(0, index);
        if (before === "#") {
          textModel.delete(0, 2);
          changed = true;
          setTextTypeForTextBlock(blockElement, TextType.Heading1);
        } else if (before === "##") {
          textModel.delete(0, 3);
          changed = true;
          setTextTypeForTextBlock(blockElement, TextType.Heading2);
        } else if (before === "###") {
          textModel.delete(0, 4);
          changed = true;
          setTextTypeForTextBlock(blockElement, TextType.Heading3);
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
