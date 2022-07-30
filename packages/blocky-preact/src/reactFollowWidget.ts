import { type EditorController, FollowWidget } from "blocky-core";
import { ComponentChild, render } from "preact";
import { unmountComponentAtNode } from "preact/compat";

export type FollowWidgetRenderer = (
  controller: EditorController
) => ComponentChild;

export class PreactFollowWidget extends FollowWidget {
  #renderer: FollowWidgetRenderer;

  constructor(renderer: FollowWidgetRenderer) {
    super();
    this.#renderer = renderer;
  }

  override widgetMounted(controller: EditorController): void {
    render(this.#renderer(controller), this.container);
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
