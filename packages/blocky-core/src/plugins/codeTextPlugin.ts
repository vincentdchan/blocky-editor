import {
  type Editor,
  type IPlugin,
  type CursorState,
  type BlockElement,
  type BlockyTextModel,
  Changeset,
} from "@pkg/index";
import Delta from "quill-delta-es";
import { isHotkey } from "is-hotkey";
import { isUndefined } from "lodash-es";

function isSuccessor(a: CursorState, b: CursorState): boolean {
  if (a.type === "open" || b.type === "open") {
    return false;
  }
  if (a.targetId !== b.targetId) {
    return false;
  }
  return b.offset === a.offset + 1;
}

function cursorGreater(a: CursorState, b: CursorState): boolean {
  if (a.type === "open" || b.type === "open") {
    return false;
  }
  if (a.targetId !== b.targetId) {
    return false;
  }
  return (a.offset | 0) > (b.offset | 0);
}

class CodeTextDetector {
  #counter = 1;
  #cursor: CursorState;
  #firstShot = false;
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
    if (!this.#firstShot) {
      if (isSuccessor(this.#cursor, cursorState)) {
        this.#cursor = cursorState;
        if (++this.#counter === 3) {
          this.#firstShot = true;
        }
        return true;
      }
      return false;
    } else {
      if (++this.#counter === 6) {
        this.done(this.startCursorState, cursorState);
        return false;
      }
      return true;
    }
  }
  emitNonDot(cursorState: CursorState | null): boolean {
    if (cursorState === null) {
      return false;
    }
    if (!this.#firstShot) {
      return false;
    }
    return cursorGreater(cursorState, this.#cursor);
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
                  if (start.type === "open" || end.type === "open") {
                    return;
                  }
                  editor.controller.enqueueNextTick(() => {
                    const blockElement = editor.state.idMap.get(
                      start.targetId
                    ) as BlockElement;
                    const textModel =
                      blockElement.firstChild as BlockyTextModel;
                    const fullString = textModel.toString();
                    const codeContent = fullString.slice(
                      start.offset + 3,
                      end.offset + 1 - 3
                    );
                    new Changeset(editor.state)
                      .textEdit(textModel, () =>
                        new Delta()
                          .retain(start.offset)
                          .delete(end.offset + 1 - start.offset)
                          .insert(codeContent, {
                            code: true,
                          })
                      )
                      .setCursorState({
                        type: "collapsed",
                        targetId: start.targetId,
                        offset: end.offset + 1 - 6,
                      })
                      .apply();
                  });
                  editor.controller.emitNextTicks();
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
