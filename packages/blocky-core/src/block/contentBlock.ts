import { elem } from "blocky-common/es/dom";
import { Observable, Subject, fromEvent, takeUntil } from "rxjs";
import { Block, BlockDidMountEvent, BlockDragOverState } from "./basic";

/**
 * Blocks except "title"
 *
 * Supports:
 * - copy & paste selection.
 * - drag & drop
 */

export class ContentBlock extends Block {
  static DragOverClassName = "blocky-drag-over";

  container: HTMLElement | null = null;
  contentContainer: HTMLElement | null = null;

  readonly #mouseEnter = new Subject<MouseEvent>();
  readonly #mouseLeave = new Subject<MouseEvent>();
  readonly #dragOver = new Subject<DragEvent>();
  readonly #drop = new Subject<DragEvent>();

  #dragOverBar: HTMLElement | undefined;

  blockDidMount(e: BlockDidMountEvent): void {
    this.container = e.element;
  }

  get dragOver$(): Observable<DragEvent> {
    return this.#dragOver.pipe(takeUntil(this.dispose$));
  }

  get drop$(): Observable<DragEvent> {
    return this.#drop.pipe(takeUntil(this.dispose$));
  }

  get mouseEnter$(): Observable<MouseEvent> {
    return this.#mouseEnter.pipe(takeUntil(this.dispose$));
  }

  get mouseLeave$(): Observable<MouseEvent> {
    return this.#mouseLeave.pipe(takeUntil(this.dispose$));
  }

  setDragOverState(state: BlockDragOverState): void {
    const container = this.container;
    if (!container) {
      return;
    }
    switch (state) {
      case BlockDragOverState.None:
        container.classList.remove(ContentBlock.DragOverClassName);
        if (this.#dragOverBar) {
          this.#dragOverBar.remove();
          this.#dragOverBar = undefined;
        }
        break;
      case BlockDragOverState.Top:
      case BlockDragOverState.Bottom: {
        container.classList.add(ContentBlock.DragOverClassName);
        const bar = this.createDragOverBar(state === BlockDragOverState.Top);
        this.#dragOverBar = bar;
        if (state === BlockDragOverState.Top) {
          container.prepend(bar);
        } else {
          container.append(bar);
        }
        break;
      }
    }
  }

  protected initBlockDnd(contentContainer: HTMLElement) {
    fromEvent<DragEvent>(contentContainer, "dragover").subscribe(
      this.#dragOver
    );
    fromEvent<DragEvent>(contentContainer, "drop").subscribe(this.#drop);
    fromEvent<MouseEvent>(contentContainer, "mouseenter").subscribe(
      this.#mouseEnter
    );
    fromEvent<MouseEvent>(contentContainer, "mouseleave").subscribe(
      this.#mouseLeave
    );
  }

  protected createDragOverBar(isTop: boolean): HTMLElement {
    const result = elem("div", "blocky-drag-over-bar");
    if (isTop) {
      result.style.top = "0px";
    } else {
      result.style.bottom = "0px";
    }
    return result;
  }
}
