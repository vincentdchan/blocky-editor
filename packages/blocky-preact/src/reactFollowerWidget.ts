import { type EditorController, FollowerWidget } from "blocky-core";
import { type ComponentChild, render } from "preact";
import { unmountComponentAtNode } from "preact/compat";

export interface FollowerWidgetProps {
  controller: EditorController;
  editingValue: string;
  closeWidget: () => void;
}

export type FollowerWidgetRenderer = (
  props: FollowerWidgetProps
) => ComponentChild;

export class PreactFollowWidget extends FollowerWidget {
  #renderer: FollowerWidgetRenderer;
  #controller: EditorController | undefined;

  constructor(renderer: FollowerWidgetRenderer) {
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
        closeWidget: () => this.dispose(),
      }),
      this.container
    );
  }

  override dispose(): void {
    unmountComponentAtNode(this.container);
    super.dispose();
  }
}

export function makePreactFollowerWidget(
  renderer: FollowerWidgetRenderer
): FollowerWidget {
  return new PreactFollowWidget(renderer);
}
