import { isWhiteSpace } from "blocky-common/es/text";
import {
  TextType,
  type Editor,
  type IPlugin,
  setTextTypeForTextBlock,
} from "@pkg/index";
import fastDiff from "fast-diff";
import Delta from "quill-delta-es";

function makeHeadingsPlugin(): IPlugin {
  return {
    name: "headings",
    onInitialized(editor: Editor) {
      editor.textInput.on((evt) => {
        const { textModel, beforeDelta, blockElement } = evt;
        const { state } = editor;
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
                setTextTypeForTextBlock(state, blockElement, TextType.Heading1);
              } else if (before === "##") {
                delta.delete(3);
                setTextTypeForTextBlock(state, blockElement, TextType.Heading2);
              } else if (before === "###") {
                delta.delete(4);
                setTextTypeForTextBlock(state, blockElement, TextType.Heading3);
              }
              break;
            }
            index += content.length;
          } else if (t == fastDiff.EQUAL) {
            index += content.length;
          }
        }

        if (delta.ops.length > 0) {
          editor.update(() => {
            textModel.compose(delta);
          });
        }
      });
    },
  };
}

export default makeHeadingsPlugin;
