import { isWhiteSpace } from "blocky-common/es/text";
import { type Editor, type IPlugin, TextType, Changeset } from "@pkg/index";
import fastDiff from "fast-diff";
import Delta from "quill-delta-es";

function makeHeadingsPlugin(): IPlugin {
  return {
    name: "headings",
    onInitialized(editor: Editor) {
      editor.textInput.on((evt) => {
        const { textModel, beforeDelta, blockElement } = evt;
        const { state } = editor;
        const changeset = new Changeset(state);
        const delta = new Delta();

        let index = 0;
        for (const [t, content] of evt.diff) {
          if (t === fastDiff.INSERT) {
            const before = beforeDelta.slice(0, index).reduce((prev, item) => {
              if (typeof item.insert === "string") {
                return prev + item.insert;
              }
              return prev;
            }, "");
            if (isWhiteSpace(content)) {
              if (before === "#") {
                delta.delete(2);
                changeset.setAttribute(blockElement, {
                  textType: TextType.Heading1,
                });
              } else if (before === "##") {
                delta.delete(3);
                changeset.setAttribute(blockElement, {
                  textType: TextType.Heading2,
                });
              } else if (before === "###") {
                delta.delete(4);
                changeset.setAttribute(blockElement, {
                  textType: TextType.Heading3,
                });
              }
              break;
            }
            index += content.length;
          } else if (t == fastDiff.EQUAL) {
            index += content.length;
          }
        }

        changeset.textEdit(textModel, () => delta);
        changeset.apply();
      });
    },
  };
}

export default makeHeadingsPlugin;
