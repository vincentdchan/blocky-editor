import { isWhiteSpace } from "blocky-common/es/text";
import type { IPlugin } from "@pkg/registry/pluginRegistry";
import type { Editor } from "@pkg/view/editor";
import type { Block, BlockElement } from "@pkg/block/basic";
import { setTextTypeForTextBlock, getTextTypeForTextBlock } from "@pkg/block/textBlock";
import { BlockyTextModel, TextType, type TextChangedEvent } from "@pkg/model";

function makeBulletListPlugin(): IPlugin {
  const turnTextBlockIntoBulletList = (editor: Editor, blockId: string, textElement: BlockElement) => {
    const textModel = textElement.firstChild! as BlockyTextModel;
    textModel.delete(0, 2);
    setTextTypeForTextBlock(textElement, TextType.Bulleted);
    editor.render(() => {
      editor.state.cursorState = {
        type: "collapsed",
        targetId: blockId,
        offset: 0,
      };
    });
  };
  const handleEveryBlock = (editor: Editor) => (block: Block) => {
    const textElement = block.props;
    if (textElement.blockName !== "text") {
      return;
    }
    const textModel = textElement.firstChild! as BlockyTextModel;
    textModel.onChanged.on((e: TextChangedEvent) => {
      if (e.type !== "text-insert") {
        return;
      }
      if (e.index === 1 && e.text.length === 1 && isWhiteSpace(e.text)) {
        const content = textModel.toString();
        if (content[0] === "-") {
          turnTextBlockIntoBulletList(editor, block.props.id, textElement);
        }
      }
    });
  };
  /**
   * If the user presses a Backspace on the start of a bullet list,
   * turn it back to a normal text.
   */
  const handleKeydown = (editor: Editor) => (e: KeyboardEvent) => {
    if (e.key !== "Backspace") {
      return;
    }
    const { cursorState } = editor.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.type === "open") {
      return;
    }

    const { targetId, offset } = cursorState;

    if (offset !== 0) {
      return;
    }

    const textElement = editor.getTextElementByBlockId(targetId);
    if (!textElement) {
      return;
    }
    const textType = getTextTypeForTextBlock(textElement);
    if (textType === TextType.Bulleted) {
      e.preventDefault();
      setTextTypeForTextBlock(textElement, TextType.Normal);
      editor.render(() => {
        editor.state.cursorState = {
          type: "collapsed",
          targetId,
          offset: 0,
        };
      });
    }
  };
  return {
    name: "bullet-list",
    onInitialized(editor: Editor) {
      editor.onEveryBlock.on(handleEveryBlock(editor));
      editor.keyDown.on(handleKeydown(editor));
    },
  };
}

export default makeBulletListPlugin;
