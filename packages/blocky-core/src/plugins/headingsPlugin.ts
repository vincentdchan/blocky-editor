import { isWhiteSpace } from "blocky-common/es/text";
import { type Editor, type IPlugin, TextType, TextBlock } from "@pkg/index";
import { Changeset } from "blocky-data";
import Delta from "quill-delta-es";
import { isNumber, isString } from "lodash-es";

function makeHeadingsPlugin(): IPlugin {
  return {
    name: "headings",
    onInitialized(editor: Editor) {
      editor.textInput
        .filter((evt) => evt.blockElement.nodeName === TextBlock.Name) // don't apply on Title block
        .on((evt) => {
          const { beforeString, blockElement } = evt;
          const { state } = editor;
          const changeset = new Changeset(state);
          const delta = new Delta();

          let index = 0;
          for (const op of evt.applyDelta.ops) {
            if (isString(op.insert)) {
              const before = beforeString.slice(0, index);
              if (isWhiteSpace(op.insert)) {
                if (before === "#") {
                  delta.delete(2);
                  changeset.updateAttributes(blockElement, {
                    textType: TextType.Heading1,
                  });
                } else if (before === "##") {
                  delta.delete(3);
                  changeset.updateAttributes(blockElement, {
                    textType: TextType.Heading2,
                  });
                } else if (before === "###") {
                  delta.delete(4);
                  changeset.updateAttributes(blockElement, {
                    textType: TextType.Heading3,
                  });
                }
                break;
              }
              index += op.insert.length;
            } else if (isNumber(op.retain)) {
              index += op.retain;
            }
          }

          changeset.textEdit(blockElement, "textContent", () => delta);
          changeset.apply();
        });
    },
  };
}

export default makeHeadingsPlugin;
