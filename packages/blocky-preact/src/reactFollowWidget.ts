import { type EditorController, FollowWidget, Editor } from "blocky-core";
import { type ComponentChild, render } from "preact";
import { unmountComponentAtNode } from "preact/compat";

export interface FollowWidgetProps {
  controller: EditorController;
  editingValue: string;
}

export type FollowWidgetRenderer = (props: FollowWidgetProps) => ComponentChild;

export class PreactFollowWidget extends FollowWidget {
  #renderer: FollowWidgetRenderer;
  #controller: EditorController | undefined;

  constructor(renderer: FollowWidgetRenderer) {
    super();
    this.#renderer = renderer;
  }

  override setEditingValue(value: string) {
    this.editingValue = value;
    this.#render();
  }

  override widgetMounted(controller: EditorController): void {
    super.widgetMounted(controller);
    this.#controller = controller;
    this.#render();
  }

  #render() {
    render(
      this.#renderer({
        controller: this.#controller!,
        editingValue: this.editingValue,
      }),
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
