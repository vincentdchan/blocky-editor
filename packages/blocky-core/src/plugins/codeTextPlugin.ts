import { type Editor, type IPlugin, TextBlock } from "@pkg/index";
import { CursorState, Changeset, Delta } from "blocky-data";
import { isHotkey } from "is-hotkey";
import { isUndefined } from "lodash-es";

class CodeTextDetector {
  #cursor: CursorState;
  constructor(
    private startCursorState: CursorState,
    private done: (
      startCursorState: CursorState,
      endCursorState: CursorState
    ) => void
  ) {
    this.#cursor = startCursorState;
  }

  emit(cursorState: CursorState | null): boolean {
    if (cursorState === null) {
      return false;
    }
    if (cursorState.offset - this.startCursorState.offset > 1) {
      this.done(this.startCursorState, cursorState);
      return false;
    }
    this.startCursorState = cursorState;
    return true;
  }

  emitNonDot(cursorState: CursorState | null): boolean {
    if (cursorState === null) {
      return false;
    }
    return cursorState.offset > this.#cursor.offset;
  }
}

function makeCodeTextPlugin(): IPlugin {
  let codeTextDetector: CodeTextDetector | undefined;
  return {
    name: "code-text",
    spans: [
      {
        name: "code",
        className: "blocky-code-text",
      },
    ],
    onInitialized(editor: Editor) {
      editor.keyDown.on((e: KeyboardEvent) => {
        if (isHotkey("mod+m", e)) {
          e.preventDefault();
          editor.controller.formatTextOnSelectedText({
            code: true,
          });
          return;
        }
        if (editor.composing) {
          return;
        }
        if (e.key === "`") {
          if (isUndefined(codeTextDetector)) {
            if (editor.state.cursorState) {
              codeTextDetector = new CodeTextDetector(
                editor.state.cursorState,
                (start: CursorState, end: CursorState) => {
                  editor.controller.enqueueNextTick(() => {
                    const blockElement = editor.state.getBlockElementById(
                      start.id
                    )!;
                    if (blockElement.nodeName !== TextBlock.Name) {
                      return;
                    }
                    const textModel = blockElement.getTextModel("textContent")!;
                    const fullString = textModel.toString();
                    const codeContent = fullString.slice(
                      start.offset + 1,
                      end.offset
                    );
                    new Changeset(editor.state)
                      .textEdit(blockElement, "textContent", () =>
                        new Delta()
                          .retain(start.offset)
                          .delete(end.offset + 1 - start.offset)
                          .insert(codeContent, {
                            code: true,
                          })
                      )
                      .setCursorState(
                        CursorState.collapse(start.id, end.offset - 1)
                      )
                      .apply();
                  });
                }
              );
            }
          } else {
            if (codeTextDetector) {
              const test = codeTextDetector.emit(editor.state.cursorState);
              if (!test) {
                codeTextDetector = undefined;
              }
            }
          }
        } else {
          if (codeTextDetector) {
            if (!codeTextDetector.emitNonDot(editor.state.cursorState)) {
              codeTextDetector = undefined;
            }
          }
        }
      });
    },
  };
}

export default makeCodeTextPlugin;
