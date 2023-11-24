import { type IDisposable, flattenDisposable } from "blocky-common/es";
import { DivContainer } from "blocky-common/es/dom";
import { Subject } from "rxjs";

export class UIDelegate extends DivContainer {
  protected shown = false;
  protected disposables: IDisposable[] = [];
  dispose$ = new Subject<void>();

  constructor(clsName?: string) {
    super(clsName);
    this.container.style.display = "none";
  }

  override dispose() {
    this.dispose$.next();
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
