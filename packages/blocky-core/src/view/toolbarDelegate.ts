import { isUndefined } from "lodash-es";
import type { EditorController } from "@pkg/view/controller";
import { UIDelegate } from "./uiDelegate";

export interface Toolbar {
  yOffset?: number;
  dispose?(): void;
}

export type ToolbarFactory = (
  dom: HTMLDivElement,
  controller: EditorController
) => Toolbar | undefined;

const DebounceDelay = 250;
const toolbarYOffset = -24;

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
  #toolbar: Toolbar | undefined;

  constructor(options: ToolbarDelegateInitOptions) {
    super("blocky-editor-toolbar-delegate blocky-cm-noselect");
    this.#controller = options.controller;
    this.#factory = options.factory;
  }

  get offsetY(): number {
    return this.#toolbar?.yOffset ?? toolbarYOffset;
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    if (this.#factory) {
      this.#toolbar = this.#factory(this.container, this.#controller);
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

  override dispose(): void {
    this.#toolbar?.dispose?.();
    this.#toolbar = undefined;
    super.dispose();
  }
}
