import { type IDisposable } from "blocky-common/es/disposable";
import { isUndefined } from "lodash-es";
import type { EditorController } from "@pkg/view/controller";
import { UIDelegate } from "./uiDelegate";

export type ToolbarFactory = (
  dom: HTMLDivElement,
  controller: EditorController
) => IDisposable | undefined;

const DebounceDelay = 250;

export interface ToolbarDelegateInitOptions {
  controller: EditorController;
  factory?: ToolbarFactory;
}

export class ToolbarDelegate extends UIDelegate {
  #enabled = false;
  #debounced: any;
  #x = 0;
  #y = 0;
  #controller: EditorController;
  #factory?: ToolbarFactory;

  constructor(options: ToolbarDelegateInitOptions) {
    super("blocky-editor-toolbar-delegate blocky-cm-noselect");
    this.#controller = options.controller;
    this.#factory = options.factory;
  }

  get offsetY(): number {
    return -16;
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    if (this.#factory) {
      const disposable = this.#factory(this.container, this.#controller);
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
    if (!isUndefined(this.#debounced)) {
      clearTimeout(this.#debounced);
      this.#debounced = undefined;
    }
    super.hide();
  }

  override show() {
    if (this.shown) {
      return;
    }
    if (isUndefined(this.#debounced)) {
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
