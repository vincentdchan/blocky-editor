import {
  TextBlock,
  type TextInputEvent,
  type IPlugin,
  type Editor,
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
      .textEdit(textElement, "textContent", () => new Delta().delete(deleteLen))
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
          const testResult = /^([0-9]+)\.$/.exec(before);
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
    },
  };
}

export default makeNumberListPlugin;
