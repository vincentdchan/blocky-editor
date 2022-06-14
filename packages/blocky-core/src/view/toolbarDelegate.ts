import { type IDisposable } from "blocky-common/es/disposable";
import type { EditorController } from "@pkg/view/controller";
import { UIDelegate } from "./uiDelegate";

export type ToolbarFactory = (dom: HTMLDivElement, editorController: EditorController) => IDisposable | undefined

export class ToolbarDelegate extends UIDelegate {

  #enabled: boolean = false;

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

}
