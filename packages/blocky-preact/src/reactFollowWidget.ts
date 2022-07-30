import { type EditorController, FollowWidget } from "blocky-core";
import { type ComponentChild, render } from "preact";
import { unmountComponentAtNode } from "preact/compat";

export interface FollowWidgetProps {
  controller: EditorController;
  editingValue: string;
}

export type FollowWidgetRenderer = (props: FollowWidgetProps) => ComponentChild;

export class PreactFollowWidget extends FollowWidget {
  #renderer: FollowWidgetRenderer;

  constructor(renderer: FollowWidgetRenderer) {
    super();
    this.#renderer = renderer;
  }

  override widgetMounted(controller: EditorController): void {
    super.widgetMounted(controller);
    render(
      this.#renderer({ controller, editingValue: this.editingValue }),
      this.container
    );
  }

  override dispose(): void {
    unmountComponentAtNode(this.container);
    super.dispose();
  }
}

export function makePreactFollowWidget(
  renderer: FollowWidgetRenderer
): FollowWidget {
  return new PreactFollowWidget(renderer);
}
