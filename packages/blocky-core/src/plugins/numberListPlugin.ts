import {
  TextBlock,
  type TextInputEvent,
  type IPlugin,
  type Editor,
  getTextTypeForTextBlock,
} from "@pkg/index";
import {
  BlockDataElement,
  CursorState,
  Changeset,
  TextType,
  Delta,
} from "blocky-data";
import { isNumber, isString } from "lodash-es";
import { isWhiteSpace } from "blocky-common/es";
import { filter, takeUntil } from "rxjs";

export function makeNumberListPlugin(): IPlugin {
  const turnTextBlockIntoNumberList = (
    editor: Editor,
    blockId: string,
    textElement: BlockDataElement,
    num: number,
    deleteLen: number
  ) => {
    new Changeset(editor.state)
      .updateAttributes(textElement, {
        textType: TextType.Numbered,
        num,
      })
      .textEdit(textElement, "textContent", () =>
        new Delta().delete(deleteLen + 1)
      )
      .setCursorState(CursorState.collapse(blockId, 0))
      .apply();
  };
  const handleTextInputEvent = (editor: Editor) => (evt: TextInputEvent) => {
    const { blockElement, beforeString } = evt;
    let index = 0;
    for (const op of evt.applyDelta.ops) {
      if (isString(op.insert)) {
        if (isWhiteSpace(op.insert)) {
          const before = beforeString.slice(0, index);
          const testResult = /^([0-9]+)\.\s?$/.exec(before);
          if (testResult && isString(testResult[1])) {
            const num = parseInt(testResult[1], 10);
            turnTextBlockIntoNumberList(
              editor,
              blockElement.id,
              blockElement,
              num,
              before.length
            );
          }
          break;
        }
        index += op.insert.length;
      } else if (isNumber(op.retain)) {
        index += op.retain;
      }
    }
  };
  const handleEnter = (editor: Editor) => (e: KeyboardEvent) => {
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
    if (textType !== TextType.Numbered) {
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
          num: undefined,
        })
        .setCursorState(CursorState.collapse(id, 0))
        .apply();
    }
  };
  const handleBackspace = (editor: Editor) => (e: KeyboardEvent) => {
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
    if (textType === TextType.Numbered) {
      e.preventDefault();
      new Changeset(editor.state)
        .updateAttributes(textElement, {
          textType: TextType.Normal,
          num: undefined,
        })
        .setCursorState(CursorState.collapse(id, 0))
        .apply();
    }
  };
  return {
    name: "number-list",
    onInitialized(context) {
      const editor = context.editor;
      editor.textInput$
        .pipe(
          takeUntil(context.dispose$),
          filter((evt) => evt.blockElement.t === TextBlock.Name)
        )
        .subscribe(handleTextInputEvent(editor));
      editor.keyDown$
        .pipe(
          takeUntil(context.dispose$),
          filter((evt) => evt.key === "Enter")
        )
        .subscribe(handleEnter(editor));
      editor.keyDown$
        .pipe(
          takeUntil(context.dispose$),
          filter((evt) => evt.key === "Backspace")
        )
        .subscribe(handleBackspace(editor));
    },
  };
}

export default makeNumberListPlugin;
