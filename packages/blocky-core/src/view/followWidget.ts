import { ContainerWithCoord } from "blocky-common/src/dom";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/src/disposable";
import type { EditorController } from "./controller";
import {
  CursorState,
  CursorStateUpdateReason,
  type CursorStateUpdateEvent,
} from "@pkg/model";
import { Slot } from "blocky-common/src/events";

/**
 * {@link FollowWidget} is a widget can follow the cursor.
 * Usually, this widget is used to implement a
 * command panel.
 */
export class FollowWidget extends ContainerWithCoord {
  protected editingValue = "";
  protected disposables: IDisposable[] = [];
  public startCursorState: CursorState | undefined;
  readonly disposing: Slot = new Slot();
  constructor() {
    super("blocky-follow-widget");
    this.disposables.push(this.disposing);
  }
  setEditingValue(value: string) {
    this.editingValue = value;
  }
  widgetMounted(controller: EditorController): void {
    this.disposables.push(
      controller.state.cursorStateChanged.on(this.#cursorUpdateHandler)
    );
  }
  #cursorUpdateHandler = (evt: CursorStateUpdateEvent) => {
    if (evt.reason !== CursorStateUpdateReason.contentChanged) {
      this.dispose();
      return;
    }
  };
  handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  }
  dispose() {
    this.disposing.emit();
    flattenDisposable(this.disposables).dispose();
    super.dispose();
  }
}
