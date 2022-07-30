import { DivContainer } from "blocky-common/src/dom";
import type { EditorController } from "./controller";

/**
 * {@link FollowWidget} is a widget can follow the cursor.
 * Usually, this widget is used to implement a
 * command panel.
 */
export abstract class FollowWidget extends DivContainer {
  constructor() {
    super("blocky-follow-widget");
  }
  widgetMounted?(controller: EditorController): void;
  handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  }
}
