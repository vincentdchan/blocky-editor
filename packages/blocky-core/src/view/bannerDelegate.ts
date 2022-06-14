import { type IDisposable } from "blocky-common/es/disposable";
import type { EditorController } from "@pkg/view/controller";
import { type DocNode, type TreeNode } from "@pkg/model";
import { UIDelegate } from "./uiDelegate";

export interface BannerProvider {
  bannerDidMount?(dom: HTMLDivElement, editorController: EditorController): IDisposable | undefined;
}

export class BannerDelegate extends UIDelegate {

  public focusedNode: TreeNode<DocNode> | undefined;

  constructor(private editorController: EditorController, private provider?: BannerProvider) {
    super("blocky-editor-banner-delegate blocky-cm-noselect");
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    if (this.provider?.bannerDidMount) {
      const disposable = this.provider.bannerDidMount(this.container, this.editorController);
      if (disposable) {
        this.disposables.push(disposable);
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

}
