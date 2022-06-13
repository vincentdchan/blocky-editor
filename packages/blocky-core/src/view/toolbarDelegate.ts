import { type IDisposable } from "blocky-common/es/disposable";
import type { EditorController } from "@pkg/view/controller";
import { UIDelegate } from "./uiDelegate";

export type ToolbarFactory = (dom: HTMLDivElement, editorController: EditorController) => IDisposable | undefined

const DebounceDelay = 250;

export class ToolbarDelegate extends UIDelegate {

  #enabled: boolean = false;
  #debounced: any;
  #x: number = 0;
  #y: number = 0;

  constructor(private editorController: EditorController, private factory?: ToolbarFactory) {
    super("blocky-editor-toolbar-delegate blocky-cm-noselect");
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    if (this.factory) {
      const disposable = this.factory(this.container, this.editorController);
      if (disposable) {
        this.disposables.push(disposable);
      }
      this.#enabled = true;
    }
  }

  get enabled() {
    return this.#enabled;
  }

  override hide() {
    if (typeof this.#debounced !== "undefined") {
      clearTimeout(this.#debounced);
      this.#debounced = undefined;
    }
    super.hide();
  }

  override show() {
    if (this.shown) {
      return;
    }
    if (typeof this.#debounced !== "undefined") {
      clearTimeout(this.#debounced);
    }

    this.#debounced = setTimeout(() => this.reallyShow(), DebounceDelay);
  }

  private reallyShow() {
    if (this.shown) {
      return;
    }
    this.#debounced = undefined;
    this.container.style.display = "";
    this.shown = true;
    if (this.shown) {
      this.container.style.top = this.#y + "px";
      this.container.style.left = this.#x + "px";
    }
  }

  setPosition(x: number, y: number) {
    this.#x = x;
    this.#y = y;
  }

}
