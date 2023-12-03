import { isWhiteSpace } from "blocky-common/es";
import { type IPlugin, TextBlock, type PluginContext } from "@pkg/index";
import { Changeset, TextType } from "@pkg/data";
import Delta from "quill-delta-es";
import { isNumber, isString } from "lodash-es";
import { filter, takeUntil } from "rxjs";

function makeQuotePlugin(): IPlugin {
  return {
    name: "quote",
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
                if (before === "|") {
                  delta.delete(2);
                  changeset.updateAttributes(blockElement, {
                    textType: TextType.Quote,
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

export default makeQuotePlugin;
