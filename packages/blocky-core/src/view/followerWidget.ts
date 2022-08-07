import { ContainerWithCoord } from "blocky-common/es/dom";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import { Slot } from "blocky-common/es/events";
import type { EditorController } from "./controller";
import {
  CursorState,
  CursorStateUpdateReason,
  type CursorStateUpdateEvent,
} from "blocky-data";

/**
 * {@link FollowerWidget} is a widget can follow the cursor.
 * Usually, this widget is used to implement a
 * command panel.
 */
export class FollowerWidget extends ContainerWithCoord {
  protected editingValue = "";
  protected disposables: IDisposable[] = [];
  startCursorState: CursorState | undefined;
  readonly disposing: Slot = new Slot();
  #controller: EditorController | undefined;
  constructor() {
    super("blocky-follow-widget");
    this.container.contentEditable = "false";
    this.disposables.push(this.disposing);
  }
  setEditingValue(value: string) {
    this.editingValue = value;
  }
  widgetMounted(controller: EditorController): void {
    this.#controller = controller;
    this.disposables.push(
      controller.state.cursorStateChanged.on(this.#cursorUpdateHandler)
    );
  }
  #cursorUpdateHandler = (evt: CursorStateUpdateEvent) => {
    if (evt.reason !== CursorStateUpdateReason.contentChanged) {
      this.dispose();
      return;
    }
    if (!evt.state || evt.state.id !== this.startCursorState?.id) {
      this.dispose();
      return;
    }
    if (evt.state.offset < this.startCursorState.offset) {
      this.dispose();
      return;
    }
    const blockElement = this.#controller!.state.getBlockElementById(
      evt.state.id
    )!;
    const textModel = blockElement.getTextModel("textContent")!;
    const textContent = textModel.toString();
    const editingValue = textContent.slice(
      this.startCursorState.offset,
      evt.state.offset
    );
    this.setEditingValue(editingValue);
  };
  dispose() {
    this.disposing.emit();
    flattenDisposable(this.disposables).dispose();
    super.dispose();
  }
}
