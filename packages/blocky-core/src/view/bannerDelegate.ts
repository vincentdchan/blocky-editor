import { type IDisposable } from "blocky-common/es/disposable";
import type { EditorController } from "@pkg/view/controller";
import type { BlockElement } from "@pkg/model";
import { UIDelegate } from "./uiDelegate";

export interface BannerInstance extends IDisposable {
  onFocusedNodeChanged?(focusedNode: BlockElement | undefined): void;
}

export type BannerFactory = (
  dom: HTMLDivElement,
  editorController: EditorController
) => BannerInstance | undefined;

export class BannerDelegate extends UIDelegate {
  #instance: BannerInstance | undefined;
  #focusedNode: BlockElement | undefined;

  get focusedNode(): BlockElement | undefined {
    return this.#focusedNode;
  }

  set focusedNode(v: BlockElement | undefined) {
    this.#focusedNode = v;
    this.#instance?.onFocusedNodeChanged?.(v);
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
