import { isWhiteSpace } from "blocky-common/es/text";
import type { IPlugin } from "@pkg/registry/pluginRegistry";
import type { Editor } from "@pkg/view/editor";
import type { Block } from "@pkg/block/basic";
import { type IModelElement, TextModel, TextType, type TextInsertEvent, setTextType, getTextType } from "@pkg/model";

function makeBulletListPlugin(): IPlugin {
  const turnTextBlockIntoBulletList = (editor: Editor, blockId: string, textElement: IModelElement) => {
    const textModel = textElement.firstChild! as TextModel;
    textModel.delete(0, 2);
    setTextType(textElement, TextType.Bulleted);
    editor.render(() => {
      editor.state.cursorState = {
        type: "collapsed",
        targetId: blockId,
        offset: 0,
      };
    });
  };
  const handleNewBlockCreated = (editor: Editor) => (block: Block) => {
    const blockData = block.props.data as IModelElement | undefined;
    if (!blockData) {
      return;
    }
    if (blockData.nodeName !== "text") {
      return;
    }
    const textModel = blockData.firstChild! as TextModel;
    textModel.onInsert.on((e: TextInsertEvent) => {
      if (e.index === 1 && e.text.length === 1 && isWhiteSpace(e.text)) {
        const content = blockData.toString();
        if (content[0] === "-") {
          turnTextBlockIntoBulletList(editor, block.props.id, blockData);
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
    const textType = getTextType(textElement);
    if (textType === TextType.Bulleted) {
      e.preventDefault();
      setTextType(textElement, TextType.Normal);
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
