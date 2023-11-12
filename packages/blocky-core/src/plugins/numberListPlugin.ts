import {
  TextBlock,
  type TextInputEvent,
  type IPlugin,
  type Editor,
} from "@pkg/index";
import { filter, takeUntil } from "rxjs";

export function makeNumberListPlugin(): IPlugin {
  const handleTextInputEvent = (editor: Editor) => (evt: TextInputEvent) => {
    console.log("handleTextInputEvent", editor, evt);
  };
  return {
    name: "number-list",
    onInitialized(context) {
      const editor = context.editor;
      editor.textInput
        .pipe(
          takeUntil(context.dispose$),
          filter((evt) => evt.blockElement.t === TextBlock.Name)
        )
        .subscribe(handleTextInputEvent(editor));
    },
  };
}

export default makeNumberListPlugin;
