import { DivContainer, $on } from "blocky-common/es/dom";
import { mkUserId } from "@pkg/helper/idHelper";

class ContainerWithCoord extends DivContainer {
  protected _x: number = 0;
  protected _y: number = 0;

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

class CurosrLabel extends ContainerWithCoord {

  static Height = 12;

  #color: string = "";

  constructor(content: string) {
    super("blocky-curosr-label");
    this.container.textContent = content;
    this.container.style.height = CurosrLabel.Height + "px";
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

export class CollaborativeCursor extends ContainerWithCoord {

  #color: string = "";
  #label: CurosrLabel | undefined;
  public name?: string;

  private initTimeout: any;

  constructor(public id: string) {
    super("blocky-collaborative-cursor");
    $on(this.container, "mouseenter", this.handleMouseEnter);
    $on(this.container, "mouseleave", this.handleMouseLeave);
  }

  mount(parent: HTMLElement): void {
    super.mount(parent);

    this.showLabel();
    this.initTimeout = setTimeout(() => {
      this.hideLabel();
    }, 3000);
  }

  private handleMouseEnter = () => {
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
      this.initTimeout = undefined;
    }
    this.showLabel();
  }

  private handleMouseLeave = () => {
    this.hideLabel();
  }

  private showLabel() {
    if (this.#label) {
      return;
    }

    const label = new CurosrLabel(this.name ?? this.id);
    label.x = this.x;
    label.y = this.y - CurosrLabel.Height;
    label.color = this.color;

    this.#label = label;

    if (this.container.parentElement) {
      label.mount(this.container.parentElement);
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
    this.container.style.backgroundColor = value;

    if (this.#label) {
      this.#label.color = value;
    }
  }

  get color() {
    return this.#color;
  }

  dispose(): void {
    this.#label?.dispose();
    super.dispose();
  }

  override set y(v: number) {
    super.y = v;

    if (this.#label) {
      this.#label.y = v - CurosrLabel.Height;
    }
  }

  override set x(v: number) {
    super.x = v;

    if (this.#label) {
      this.#label.x = v;
    }
  }

}

export interface CollaborativeCursorOptions {
  id: string;
  idToName: (id: string) => string;
  idToColor: (id: string) => string,
}

function makeDefaultOptions(): CollaborativeCursorOptions {
  return {
    id: mkUserId(),
    idToName: (id: string) => id,
    idToColor: (id: string) => "yellow",
  };
}

export class CollaborativeCursorManager extends DivContainer {
  #cursors: Map<string, CollaborativeCursor> = new Map;

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
    cursor.mount(this.container);
    this.#cursors.set(id, cursor);
  }

  getOrInit(id: string): CollaborativeCursor {
    const test = this.#cursors.get(id);
    if (test) {
      return test;
    }

    const newCursor = new CollaborativeCursor(id);

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
