import { isWhiteSpace } from "blocky-common/es";
import { isNumber, isString } from "lodash-es";
import {
  BlockDataElement,
  CursorState,
  Changeset,
  TextType,
  Delta,
} from "blocky-data";
import { filter, takeUntil } from "rxjs";
import {
  getTextTypeForTextBlock,
  TextBlock,
  type TextInputEvent,
  type IPlugin,
  type Editor,
  type PluginContext,
} from "@pkg/index";

function makeBulletListPlugin(): IPlugin {
  const turnTextBlockIntoBulletList = (
    editor: Editor,
    blockId: string,
    textElement: BlockDataElement
  ) => {
    new Changeset(editor.state)
      .updateAttributes(textElement, {
        textType: TextType.Bulleted,
      })
      .textEdit(textElement, "textContent", () => new Delta().delete(2))
      .setCursorState(CursorState.collapse(blockId, 0))
      .apply();
  };
  const handleTextInputEvent = (editor: Editor) => (evt: TextInputEvent) => {
    const { blockElement, beforeString } = evt;
    let index = 0;
    for (const op of evt.applyDelta.ops) {
      if (isString(op.insert)) {
        if (index === 1 && isWhiteSpace(op.insert)) {
          const before = beforeString.slice(0, index);
          if (before === "-") {
            turnTextBlockIntoBulletList(editor, blockElement.id, blockElement);
          }
          break;
        }
        index += op.insert.length;
      } else if (isNumber(op.retain)) {
        index += op.retain;
      }
    }
  };
  const handleEnter = (editor: Editor, e: KeyboardEvent) => {
    const { cursorState } = editor.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.isOpen) {
      return;
    }

    const { id, offset } = cursorState;
    if (offset !== 0) {
      return;
    }

    const textElement = editor.getTextElementByBlockId(id);
    if (!textElement || textElement.t !== TextBlock.Name) {
      return;
    }

    const textType = getTextTypeForTextBlock(textElement);
    if (textType !== TextType.Bulleted) {
      return;
    }
    const textModel = textElement.getTextModel("textContent");
    if (!textModel) {
      return;
    }
    if (textModel.length === 0) {
      e.preventDefault();
      new Changeset(editor.state)
        .updateAttributes(textElement, {
          textType: TextType.Normal,
        })
        .setCursorState(CursorState.collapse(id, 0))
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
    if (cursorState.isOpen) {
      return;
    }

    const { id, offset } = cursorState;

    if (offset !== 0) {
      return;
    }

    const textElement = editor.getTextElementByBlockId(id);
    if (!textElement) {
      return;
    }
    const textType = getTextTypeForTextBlock(textElement);
    if (textType === TextType.Bulleted) {
      e.preventDefault();
      new Changeset(editor.state)
        .updateAttributes(textElement, {
          textType: TextType.Normal,
        })
        .setCursorState(CursorState.collapse(id, 0))
        .apply();
    }
  };
  return {
    name: "bullet-list",
    onInitialized(context: PluginContext) {
      const { editor, dispose$ } = context;
      editor.textInput
        .pipe(
          takeUntil(dispose$),
          filter((evt) => evt.blockElement.t === TextBlock.Name)
        )
        .subscribe(handleTextInputEvent(editor));
      editor.keyDown.pipe(takeUntil(dispose$)).subscribe(handleKeydown(editor));
    },
  };
}

export default makeBulletListPlugin;
