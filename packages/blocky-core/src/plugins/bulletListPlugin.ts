import { isWhiteSpace } from "blocky-common/es/text";
import type { IPlugin } from "@pkg/registry/pluginRegistry";
import type { Editor } from "@pkg/view/editor";
import type { Block } from "@pkg/block/basic";
import { TextModel, TextType, type TextInsertEvent } from "@pkg/model";

function makeBulletListPlugin(): IPlugin {
  const turnTextBlockIntoBulletList = (editor: Editor, blockId: string, textModel: TextModel) => {
    textModel.delete(0, 2);
    textModel.textType = TextType.Bulleted;
    editor.render(() => {
      editor.state.cursorState = {
        type: "collapsed",
        targetId: blockId,
        offset: 0,
      };
    });
  };
  const handleNewBlockCreated = (editor: Editor) => (block: Block) => {
    const blockData = block.props.data;
    if (blockData && blockData instanceof TextModel) {
      blockData.onInsert.on((e: TextInsertEvent) => {
        if (e.index === 1 && e.text.length === 1 && isWhiteSpace(e.text)) {
          const content = blockData.toString();
          if (content[0] === "-") {
            turnTextBlockIntoBulletList(editor, block.props.id, blockData);
          }
        }
      });
    }
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

    const textModel = editor.getTextModelByBlockId(targetId);
    if (textModel && textModel.textType === TextType.Bulleted) {
      e.preventDefault();
      textModel.textType = TextType.Normal;
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
      editor.state.newBlockCreated.on(handleNewBlockCreated(editor));
      editor.keyDown.on(handleKeydown(editor));
    },
  };
}

export default makeBulletListPlugin;
