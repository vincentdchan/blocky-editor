import { type IDisposable } from "blocky-common/es";
import type { EditorController } from "@pkg/view/controller";
import type { BlockDataElement } from "blocky-data";
import { UIDelegate } from "./uiDelegate";

export interface BannerInstance extends IDisposable {
  onFocusedNodeChanged?(focusedNode: BlockDataElement | undefined): void;
}

export type BannerFactory = (
  dom: HTMLDivElement,
  editorController: EditorController
) => BannerInstance | undefined;

export class BannerDelegate extends UIDelegate {
  #instance: BannerInstance | undefined;
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
    private factory?: BannerFactory
  ) {
    super("blocky-editor-banner-delegate blocky-cm-noselect");
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    if (this.factory) {
      this.#instance = this.factory(this.container, this.editorController);
      if (this.#instance) {
        this.disposables.push(this.#instance);
      }
    } else {
      this.renderFallback();
    }
  }

  renderFallback() {
    this.container.style.width = "16px";
    this.container.style.height = "16px";
    this.container.style.backgroundColor = "grey";
  }

  setPosition(x: number, y: number) {
    this.container.style.top = y + "px";
    this.container.style.left = x + "px";
  }
}
