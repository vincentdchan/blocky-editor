import { isWhiteSpace } from "blocky-common/es/text";
import Delta from "quill-delta-es";
import fastDiff from "fast-diff";
import {
  BlockyTextModel,
  TextType,
  getTextTypeForTextBlock,
  BlockElement,
  TextBlockName,
  Changeset,
  type TextInputEvent,
  type IPlugin,
  type Editor,
} from "@pkg/index";

function makeBulletListPlugin(): IPlugin {
  const turnTextBlockIntoBulletList = (
    editor: Editor,
    blockId: string,
    textModel: BlockyTextModel,
    textElement: BlockElement
  ) => {
    new Changeset(editor.state)
      .setAttribute(textElement, {
        textType: TextType.Bulleted,
      })
      .textEdit(textModel, () => new Delta().delete(2))
      .setCursorState({
        type: "collapsed",
        targetId: blockId,
        offset: 0,
      })
      .apply();
  };
  const handleTextInputEvent = (editor: Editor) => (evt: TextInputEvent) => {
    const { beforeDelta, textModel } = evt;
    let index = 0;
    for (const [t, content] of evt.diff) {
      if (t === fastDiff.INSERT) {
        if (index === 1 && isWhiteSpace(content)) {
          const before = beforeDelta.slice(0, index).reduce((prev, item) => {
            if (typeof item.insert === "string") {
              return prev + item.insert;
            }
            return prev;
          }, "");
          if (before === "-") {
            turnTextBlockIntoBulletList(
              editor,
              evt.blockElement.id,
              textModel,
              evt.blockElement
            );
          }
          break;
        }
        index += content.length;
      } else {
        index += content.length;
      }
    }
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
      new Changeset(editor.state)
        .setAttribute(textElement, {
          textType: TextType.Normal,
        })
        .setCursorState({
          type: "collapsed",
          targetId,
          offset: 0,
        })
        .apply();
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
      new Changeset(editor.state)
        .setAttribute(textElement, {
          textType: TextType.Normal,
        })
        .setCursorState({
          type: "collapsed",
          targetId,
          offset: 0,
        })
        .apply();
    }
  };
  return {
    name: "bullet-list",
    onInitialized(editor: Editor) {
      editor.textInput.on(handleTextInputEvent(editor));
      editor.keyDown.on(handleKeydown(editor));
    },
  };
}

export default makeBulletListPlugin;
