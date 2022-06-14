import { type IDisposable } from "blocky-common/es/disposable";
import type { EditorController } from "@pkg/view/controller";
import { UIDelegate } from "./uiDelegate";

export interface ToolbarProvider {
  toolbarDidMount?(dom: HTMLDivElement, editorController: EditorController): IDisposable | undefined;
}

export class ToolbarDelegate extends UIDelegate {

  #enabled: boolean = false;

  constructor(private editorController: EditorController, private provider?: ToolbarProvider) {
    super("blocky-editor-toolbar-delegate blocky-cm-noselect");
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    if (this.provider?.toolbarDidMount) {
      const disposable = this.provider.toolbarDidMount(this.container, this.editorController);
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
