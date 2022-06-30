import { DivContainer } from "blocky-common/es/dom";
import { mkUserId } from "@pkg/helper/idHelper";

export class CollaborativeCursor extends DivContainer {

  public color?: string;
  public name?: string;

  constructor(public id: string) {
    super("blocky-collaborative-cursor");
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
