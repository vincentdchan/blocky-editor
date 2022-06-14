import { DivContainer } from "blocky-common/es/dom";
import type { EditorController } from "@pkg/view/controller";
import { type DocNode, type TreeNode } from "@pkg/model";

export interface BannerProvider {
  bannerDidMount?: (dom: HTMLDivElement, editorController: EditorController) => void;
  bannerWillUnmount?: (dom: HTMLDivElement) => void;
}

export class BannerDelegate extends DivContainer {

  #shown: boolean = false;
  public focusedNode: TreeNode<DocNode> | undefined;

  constructor(private editorController: EditorController, private provider?: BannerProvider) {
    super("blocky-editor-banner-delegate blocky-cm-noselect");
    this.container.style.display = "none";
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    if (this.provider?.bannerDidMount) {
      this.provider.bannerDidMount(this.container, this.editorController);
    } else {
      this.renderFallback();
    }
  }

  renderFallback() {
    this.container.style.width = "16px";
    this.container.style.height = "16px";
    this.container.style.backgroundColor = "grey";
  }

  hide() {
    if (!this.#shown) {
      return;
    }
    this.container.style.display = "none";
    this.#shown = false;
  }

  show() {
    if (this.#shown) {
      return;
    }
    this.container.style.display = "";
    this.#shown = true;
  }

  setPosition(x: number, y: number) {
    this.container.style.top = y + "px";
    this.container.style.left = x + "px";
  }

  override dispose(): void {
    this.provider?.bannerWillUnmount?.(this.container);
    super.dispose();
  }

}
