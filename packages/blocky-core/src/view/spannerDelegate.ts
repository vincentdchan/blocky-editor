import { type IDisposable } from "blocky-common/es";
import type { EditorController } from "@pkg/view/controller";
import type { BlockDataElement } from "@pkg/data";
import { UIDelegate } from "./uiDelegate";
import { fromEvent, takeUntil } from "rxjs";

export interface SpannerInstance extends IDisposable {
  onFocusedNodeChanged?(focusedNode: BlockDataElement | undefined): void;
}

export type SpannerFactory = (
  dom: HTMLDivElement,
  editorController: EditorController
) => SpannerInstance | undefined;

export class SpannerDelegate extends UIDelegate {
  #instance: SpannerInstance | undefined;
  #focusedNode: BlockDataElement | undefined;

  get focusedNode(): BlockDataElement | undefined {
    return this.#focusedNode;
  }

  set focusedNode(v: BlockDataElement | undefined) {
    this.#focusedNode = v;
    this.#instance?.onFocusedNodeChanged?.(v);
  }

  get width(): number {
    return 28;
  }

  constructor(
    private editorController: EditorController,
    private factory: SpannerFactory
  ) {
    super("blocky-editor-spanner-delegate blocky-cm-noselect");
    // draggable
    this.container.setAttribute("draggable", "true");

    const dragStart$ = fromEvent<DragEvent>(this.container, "dragstart");
    dragStart$
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.#handleDragStart.bind(this));
  }

  #handleDragStart(e: DragEvent) {
    console.log("drag start:", e);
  }

  override mount(parent: HTMLElement): void {
    super.mount(parent);

    this.#instance = this.factory(this.container, this.editorController);
    if (this.#instance) {
      this.disposables.push(this.#instance);
    }
  }

  setPosition(x: number, y: number) {
    this.container.style.top = y + "px";
    this.container.style.left = x + "px";
  }
}
