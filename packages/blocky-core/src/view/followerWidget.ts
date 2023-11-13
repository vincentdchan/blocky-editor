import { ContainerWithCoord } from "blocky-common/es/dom";
import { type IDisposable, flattenDisposable } from "blocky-common/es";
import { Subject, takeUntil } from "rxjs";
import type { EditorController } from "./controller";
import {
  BlockDataElement,
  CursorState,
  CursorStateUpdateReason,
  type CursorStateUpdateEvent,
} from "@pkg/data";

/**
 * {@link FollowerWidget} is a widget can follow the cursor.
 * Usually, this widget is used to implement a
 * command panel.
 */
export class FollowerWidget extends ContainerWithCoord {
  protected editingValue = "";
  protected focusedNode: BlockDataElement | undefined;
  protected disposables: IDisposable[] = [];
  startCursorState: CursorState | undefined;
  readonly dispose$ = new Subject<void>();
  #controller: EditorController | undefined;
  #atTop = false;
  constructor() {
    super("blocky-follow-widget");
    this.container.contentEditable = "false";
    this.x = -1000;
    this.y = -1000;
  }

  /**
   * Can be override, specific the y offset
   * from the cursor to the FollowerWidget
   */
  get yOffset(): number {
    return 32;
  }

  get maxHeight(): number | undefined {
    return undefined;
  }

  get atTop() {
    return this.#atTop;
  }

  set atTop(v: boolean) {
    this.#atTop = v;
  }

  setEditingValue(value: string) {
    this.editingValue = value;
  }

  widgetMounted(controller: EditorController): void {
    this.#controller = controller;
    controller.state.cursorStateChanged
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.#cursorUpdateHandler);
    const cursor = this.#controller!.state.cursorState;
    if (cursor) {
      this.focusedNode = this.#controller!.state.getBlockElementById(cursor.id);
    }
  }

  widgetAfterReposition?(): void;

  #cursorUpdateHandler = (evt: CursorStateUpdateEvent) => {
    if (evt.reason !== CursorStateUpdateReason.contentChanged) {
      this.dispose();
      return;
    }
    if (!evt.state || evt.state.id !== this.startCursorState?.id) {
      this.dispose();
      return;
    }
    if (evt.state.offset < this.startCursorState.offset) {
      this.dispose();
      return;
    }
    const blockElement = this.#controller!.state.getBlockElementById(
      evt.state.id
    )!;
    const textModel = blockElement.getTextModel("textContent")!;
    const textContent = textModel.toString();
    const editingValue = textContent.slice(
      this.startCursorState.offset,
      evt.state.offset
    );
    this.setEditingValue(editingValue);
  };

  dispose() {
    this.dispose$.next();
    flattenDisposable(this.disposables).dispose();
    super.dispose();
  }
}
