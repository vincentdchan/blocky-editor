import { isWhiteSpace } from "blocky-common/es/text";
import Delta from "quill-delta-es";
import {
  BlockyTextModel,
  TextType,
  setTextTypeForTextBlock,
  getTextTypeForTextBlock,
  Block,
  BlockElement,
  TextBlockName,
  type IPlugin,
  type Editor,
} from "@pkg/index";

function makeBulletListPlugin(): IPlugin {
  const turnTextBlockIntoBulletList = (
    editor: Editor,
    blockId: string,
    textElement: BlockElement
  ) => {
    const textModel = textElement.firstChild! as BlockyTextModel;
    setTextTypeForTextBlock(textElement, TextType.Bulleted);
    editor.update(() => {
      textModel.compose(new Delta().delete(2));
      return () => {
        editor.state.cursorState = {
          type: "collapsed",
          targetId: blockId,
          offset: 0,
        };
      };
    });
  };
  const handleEveryBlock = (editor: Editor) => (block: Block) => {
    const textElement = block.props;
    if (textElement.nodeName !== TextBlockName) {
      return;
    }
    const textModel = textElement.firstChild! as BlockyTextModel;
    // textModel.changed.on((e: TextChangedEvent) => {
    //   if (e.type !== "text-insert") {
    //     return;
    //   }
    //   if (e.index === 1 && e.text.length === 1 && isWhiteSpace(e.text)) {
    //     const content = textModel.toString();
    //     if (content[0] === "-") {
    //       turnTextBlockIntoBulletList(editor, block.props.id, textElement);
    //     }
    //   }
    // });
  };
  const handleEnter = (editor: Editor, e: KeyboardEvent) => {
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
    if (!textElement || textElement.nodeName !== TextBlockName) {
      return;
    }

    const textType = getTextTypeForTextBlock(textElement);
    if (textType !== TextType.Bulleted) {
      return;
    }
    const textModel = textElement.firstChild as BlockyTextModel | undefined;
    if (!textModel) {
      return;
    }
    if (textModel.length === 0) {
      e.preventDefault();
      editor.state.cursorState = undefined;
      editor.update(() => {
        setTextTypeForTextBlock(textElement, TextType.Normal);
        return () => {
          editor.state.cursorState = {
            type: "collapsed",
            targetId,
            offset: 0,
          };
        };
      });
    }
  };
  /**
   * If the user presses a Backspace on the start of a bullet list,
   * turn it back to a normal text.
   */
  const handleKeydown = (editor: Editor) => (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEnter(editor, e);
      return;
    }
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
      editor.state.cursorState = undefined;
      editor.update(() => {
        setTextTypeForTextBlock(textElement, TextType.Normal);
        return () => {
          editor.state.cursorState = {
            type: "collapsed",
            targetId,
            offset: 0,
          };
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
