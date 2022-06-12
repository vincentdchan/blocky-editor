import { DivContainer } from "blocky-common/es/dom";

export interface BannerDelegateOptions {
  bannerDidMount?: (dom: HTMLDivElement) => void;
}

export class BannerDelegate extends DivContainer {

  #shown: boolean = false;

  constructor(private options?: BannerDelegateOptions) {
    super("blocky-editor-banner-delegate");
    this.container.style.display = "none";
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    if (this.options?.bannerDidMount) {
      this.options.bannerDidMount(this.container);
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

}
