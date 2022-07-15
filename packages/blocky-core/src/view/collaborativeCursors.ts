import { DivContainer } from "blocky-common/es/dom";
import { Slot } from "blocky-common/es/events";
import { mkUserId } from "@pkg/helper/idHelper";

class ContainerWithCoord extends DivContainer {
  protected _x = 0;
  protected _y = 0;

  get x() {
    return this._x;
  }

  set x(v: number) {
    if (v === this._x) {
      return;
    }
    this.container.style.left = v + "px";
    this._x = v;
  }

  get y() {
    return this._y;
  }

  set y(v: number) {
    if (v === this._y) {
      return;
    }
    this.container.style.top = v + "px";
    this._y = v;
  }
}

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
  public readonly mouseEnter: Slot<MouseEvent>;
  public readonly mouseLeave: Slot<MouseEvent>;
  constructor() {
    super("blocky-collaborative-cursor-rect");
    this.mouseEnter = Slot.fromEvent(this.container, "mouseenter");
    this.mouseLeave = Slot.fromEvent(this.container, "mouseleave");
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
  public name?: string;

  private initTimeout: any;

  constructor(public id: string, private parent: HTMLElement) {}

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

  private handleMouseEnter = () => {
    this.#debouncedShowLabel();
  };

  private handleMouseLeave = () => {
    this.hideLabel();
  };

  private showLabel() {
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

  private hideLabel() {
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
      this.#rects.push(cursorRect);
    }

    if (this.#label) {
      const firstRect = rects[0];
      this.#label.x = firstRect.x;
      this.#label.y = firstRect.y - CursorLabel.Height * 1.5;
    }

    this.#debouncedShowLabel();
  }

  #createCursorRectWithCoord(): CollaborativeCursorRect {
    const cursorRect = new CollaborativeCursorRect();
    cursorRect.mouseEnter.on(this.handleMouseEnter);
    cursorRect.mouseLeave.on(this.handleMouseLeave);
    cursorRect.setColor(this.#color);
    cursorRect.setHeight(this.#height);
    cursorRect.mount(this.parent);
    return cursorRect;
  }

  #debouncedShowLabel() {
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
    }
    this.showLabel();
    this.initTimeout = setTimeout(() => {
      this.hideLabel();
      this.initTimeout = undefined;
    }, 3000);
  }

  #clearAllRects() {
    this.#rects.forEach((rect) => rect.dispose());
  }

  dispose(): void {
    this.#label?.dispose();
    for (const rect of this.#rects) {
      rect.dispose();
    }
    this.#rects.length = 0;
  }
}

export interface CollaborativeCursorOptions {
  id: string;
  idToName: (id: string) => string;
  idToColor: (id: string) => string;
}

function makeDefaultOptions(): CollaborativeCursorOptions {
  return {
    id: mkUserId(),
    idToName: (id: string) => id,
    idToColor: () => "yellow",
  };
}

export class CollaborativeCursorManager extends DivContainer {
  #cursors: Map<string, CollaborativeCursor> = new Map();

  public readonly options: CollaborativeCursorOptions;

  constructor(options?: Partial<CollaborativeCursor>) {
    super("blocky-collaborative-cursor-container");
    this.options = {
      ...makeDefaultOptions(),
      ...options,
    };
  }

  private insert(cursor: CollaborativeCursor) {
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

    const newCursor = new CollaborativeCursor(id, this.container);

    this.insert(newCursor);

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
