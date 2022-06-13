import { type IDisposable, flattenDisposable } from "blocky-common/es/disposable";
import { DivContainer } from "blocky-common/es/dom";

export class UIDelegate extends DivContainer {
  protected shown: boolean = false;
  protected disposables: IDisposable[] = [];

  constructor(clsName?: string) {
    super(clsName);
    this.container.style.display = "none";
  }

  override dispose() {
    flattenDisposable(this.disposables).dispose();
    super.dispose();
  }

  hide() {
    if (!this.shown) {
      return;
    }
    this.container.style.display = "none";
    this.shown = false;
  }

  show() {
    if (this.shown) {
      return;
    }
    this.container.style.display = "";
    this.shown = true;
  }

}
