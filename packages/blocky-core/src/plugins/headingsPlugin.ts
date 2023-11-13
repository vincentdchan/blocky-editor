import { isWhiteSpace } from "blocky-common/es";
import { type IPlugin, TextBlock, type PluginContext } from "@pkg/index";
import { Changeset, TextType, Delta } from "blocky-data";
import { isNumber, isString } from "lodash-es";
import { filter, takeUntil } from "rxjs";

function makeHeadingsPlugin(): IPlugin {
  return {
    name: "headings",
    onInitialized(context: PluginContext) {
      const { editor, dispose$ } = context;
      editor.textInput$
        .pipe(
          takeUntil(dispose$),
          filter((evt) => evt.blockElement.t === TextBlock.Name) // don't apply on Title block
        )
        .subscribe((evt) => {
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
