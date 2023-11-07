import { type EditorController, FollowerWidget } from "blocky-core";
import { isNumber } from "lodash-es";
import React from "react";
import { createRoot, Root } from "react-dom/client";

export interface FollowerWidgetProps {
  controller: EditorController;
  editingValue: string;
  atTop: boolean;
  closeWidget: () => void;
}

export type FollowerWidgetRenderer = (
  props: FollowerWidgetProps
) => React.ReactNode;

export interface PreactFollowWidgetOptions {
  yOffset?: number;
  maxHeight?: number;
}

export class PreactFollowWidget extends FollowerWidget {
  #renderer: FollowerWidgetRenderer;
  #controller: EditorController | undefined;
  #yOffset: number | undefined;
  #maxHeight: number | undefined;
  #root: Root | undefined;

  constructor(
    renderer: FollowerWidgetRenderer,
    options?: PreactFollowWidgetOptions
  ) {
    super();
    this.#renderer = renderer;
    this.#yOffset = options?.yOffset;
    this.#maxHeight = options?.maxHeight;
  }

  override get yOffset(): number {
    if (isNumber(this.#yOffset)) {
      return this.#yOffset;
    }
    return super.yOffset;
  }

  override get maxHeight(): number | undefined {
    if (isNumber(this.#maxHeight)) {
      return this.#maxHeight;
    }
    return super.maxHeight;
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

  override widgetAfterReposition() {
    this.#render();
  }

  #render() {
    this.#root?.unmount();
    this.#root = createRoot(this.container);
    this.#root.render(
      this.#renderer({
        controller: this.#controller!,
        editingValue: this.editingValue,
        atTop: this.atTop,
        closeWidget: () => this.dispose(),
      }),
    );
  }

  override dispose(): void {
    this.#root?.unmount();
    super.dispose();
  }
}

export function makePreactFollowerWidget(
  renderer: FollowerWidgetRenderer,
  options?: PreactFollowWidgetOptions
): FollowerWidget {
  return new PreactFollowWidget(renderer, options);
}
