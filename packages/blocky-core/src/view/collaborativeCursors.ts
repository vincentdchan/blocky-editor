import { ContainerWithCoord, DivContainer } from "blocky-common/es/dom";
import { Observable, fromEvent } from "rxjs";

class CursorLabel extends ContainerWithCoord {
  static Height = 12;

  #color = "";

  constructor(content: string) {
    super("blocky-cursor-label");
    this.container.textContent = content;
    this.container.style.height = CursorLabel.Height + "px";
  }

  set color(value: string) {
    if (value === this.#color) {
      return;
    }
    this.#color = value;
    this.container.style.backgroundColor = value;
  }

  get color() {
    return this.#color;
  }
}

const minWidthOfCursor = 2;

class CollaborativeCursorRect extends ContainerWithCoord {
  readonly mouseEnter: Observable<MouseEvent>;
  readonly mouseLeave: Observable<MouseEvent>;
  constructor() {
    super("blocky-collaborative-cursor-rect");
    this.mouseEnter = fromEvent<MouseEvent>(this.container, "mouseenter");
    this.mouseLeave = fromEvent<MouseEvent>(this.container, "mouseleave");
  }

  setColor(color: string) {
    this.container.style.backgroundColor = color;
  }

  setHeight(v: number) {
    this.container.style.height = v + "px";
  }

  setWidth(v: number) {
    this.container.style.width = v + "px";
  }
}

/**
 * The drawer of the collaborative cursor.
 * This class will draw the rectangles and the label.
 */
export class CollaborativeCursor {
  #color = "";
  #label: CursorLabel | undefined;
  #height = 0;
  #rects: CollaborativeCursorRect[] = [];
  #x = 0;
  #y = 0;
  name?: string;

  private initTimeout: any;

  constructor(
    public id: string,
    readonly client: CollaborativeCursorClient,
    private parent: HTMLElement
  ) {
    this.color = client.color;
    this.name = client.name;
  }

  get height() {
    return this.#height;
  }

  set height(v: number) {
    if (this.#height === v) {
      return;
    }
    this.#height = v;

    for (const rect of this.#rects) {
      rect.container.style.height = this.#height + "px";
    }
  }

  #handleMouseEnter = () => {
    this.#debouncedShowLabel();
  };

  #handleMouseLeave = () => {
    this.#hideLabel();
  };

  #showLabel() {
    if (this.#label) {
      return;
    }

    const label = new CursorLabel(this.name ?? this.id);
    label.x = this.#x;
    label.y = this.#y - CursorLabel.Height * 1.5;
    label.color = this.color;

    this.#label = label;

    if (this.parent) {
      label.mount(this.parent);
    }
  }

  #hideLabel() {
    if (!this.#label) {
      return;
    }
    this.#label.dispose();
    this.#label = undefined;
  }

  set color(value: string) {
    if (value === this.#color) {
      return;
    }
    this.#color = value;

    for (const rect of this.#rects) {
      rect.container.style.backgroundColor = value;
    }

    if (this.#label) {
      this.#label.color = value;
    }
  }

  get color() {
    return this.#color;
  }

  drawCollapsedRect(x: number, y: number) {
    let cursorRect: CollaborativeCursorRect;
    this.#x = x;
    this.#y = y;

    if (this.#rects.length !== 1) {
      this.#clearAllRects();
      cursorRect = this.#createCursorRectWithCoord();
      this.#rects.push(cursorRect);
    } else {
      cursorRect = this.#rects[0];
    }
    cursorRect.x = x;
    cursorRect.y = y;
    cursorRect.setWidth(minWidthOfCursor);

    if (this.#label) {
      this.#label.x = x;
      this.#label.y = y - CursorLabel.Height * 1.5;
    }

    this.#debouncedShowLabel();
  }

  drawRects(rects: DOMRect[]) {
    this.#clearAllRects();
    if (rects.length === 0) {
      return;
    }

    for (const rect of rects) {
      const cursorRect = this.#createCursorRectWithCoord();
      cursorRect.x = rect.x;
      cursorRect.y = rect.y;
      cursorRect.setWidth(Math.max(minWidthOfCursor, rect.width));
      cursorRect.setHeight(rect.height);
      this.#rects.push(cursorRect);
    }

    const firstRect = rects[0];
    this.#x = firstRect.x;
    this.#y = firstRect.y;

    if (this.#label) {
      this.#label.x = this.#x;
      this.#label.y = this.#y - CursorLabel.Height * 1.5;
    }

    this.#debouncedShowLabel();
  }

  #createCursorRectWithCoord(): CollaborativeCursorRect {
    const cursorRect = new CollaborativeCursorRect();
    cursorRect.mouseEnter.subscribe(this.#handleMouseEnter);
    cursorRect.mouseLeave.subscribe(this.#handleMouseLeave);
    cursorRect.setColor(this.#color);
    cursorRect.setHeight(this.#height);
    cursorRect.mount(this.parent);
    return cursorRect;
  }

  #debouncedShowLabel() {
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
    }
    this.#showLabel();
    this.initTimeout = setTimeout(() => {
      this.#hideLabel();
      this.initTimeout = undefined;
    }, 3000);
  }

  #clearAllRects() {
    this.#rects.forEach((rect) => rect.dispose());
  }

  dispose(): void {
    this.client.dispose?.();
    this.#label?.dispose();
    for (const rect of this.#rects) {
      rect.dispose();
    }
    this.#rects.length = 0;
  }
}

export interface CollaborativeCursorClient {
  get name(): string;
  get color(): string;
  dispose?(): void;
}

export type CollaborativeCursorFactory = (
  id: string
) => CollaborativeCursorClient;

const defaultFactory: CollaborativeCursorFactory = (id: string) => ({
  get name() {
    return id;
  },
  get color() {
    return "yellow";
  },
});

export class CollaborativeCursorManager extends DivContainer {
  #cursors: Map<string, CollaborativeCursor> = new Map();

  readonly factory: CollaborativeCursorFactory;

  constructor(factory?: CollaborativeCursorFactory) {
    super("blocky-collaborative-cursor-container");
    this.factory = factory ?? defaultFactory;
  }

  #insert(cursor: CollaborativeCursor) {
    const { id } = cursor;
    if (this.#cursors.has(id)) {
      throw new Error("cursor has been inserted");
    }
    this.#cursors.set(id, cursor);
  }

  getOrInit(id: string): CollaborativeCursor {
    const test = this.#cursors.get(id);
    if (test) {
      return test;
    }

    const client = this.factory(id);
    const newCursor = new CollaborativeCursor(id, client, this.container);

    this.#insert(newCursor);

    return newCursor;
  }

  deleteById(id: string) {
    const test = this.#cursors.get(id);
    if (!test) {
      return;
    }

    test.dispose();
    this.#cursors.delete(id);
  }
}
