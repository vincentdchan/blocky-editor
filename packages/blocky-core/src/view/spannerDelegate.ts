import { type IDisposable } from "blocky-common/es";
import type { EditorController } from "@pkg/view/controller";
import type { BlockDataElement } from "blocky-data";
import { UIDelegate } from "./uiDelegate";

export interface SpannerInstance extends IDisposable {
  onFocusedNodeChanged?(focusedNode: BlockDataElement | undefined): void;
}

export type SpannerFactory = (
  dom: HTMLDivElement,
  editorController: EditorController
) => SpannerInstance | undefined;

export class SpannerDelegate extends UIDelegate {
  #instance: SpannerInstance | undefined;
  #focusedNode: BlockDataElement | undefined;

  get focusedNode(): BlockDataElement | undefined {
    return this.#focusedNode;
  }

  set focusedNode(v: BlockDataElement | undefined) {
    this.#focusedNode = v;
    this.#instance?.onFocusedNodeChanged?.(v);
  }

  get width(): number {
    return 28;
  }

  constructor(
    private editorController: EditorController,
    private factory: SpannerFactory
  ) {
    super("blocky-editor-spanner-delegate blocky-cm-noselect");
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    this.#instance = this.factory(this.container, this.editorController);
    if (this.#instance) {
      this.disposables.push(this.#instance);
    }
  }

  setPosition(x: number, y: number) {
    this.container.style.top = y + "px";
    this.container.style.left = x + "px";
  }
}
