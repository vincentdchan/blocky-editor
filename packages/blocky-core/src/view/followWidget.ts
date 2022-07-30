import { ContainerWithCoord } from "blocky-common/src/dom";
import type { EditorController } from "./controller";

/**
 * {@link FollowWidget} is a widget can follow the cursor.
 * Usually, this widget is used to implement a
 * command panel.
 */
export abstract class FollowWidget extends ContainerWithCoord {
  protected editingValue = "";
  constructor() {
    super("blocky-follow-widget");
  }
  setEditingValue(value: string) {
    this.editingValue = value;
  }
  widgetMounted?(controller: EditorController): void;
  handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  }
}
