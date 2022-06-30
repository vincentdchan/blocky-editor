import type { IDisposable } from "blocky-common/src/disposable";
import { Slot } from "blocky-common/src/events";

export class CollaborativeCursor implements IDisposable {

  public readonly disposing: Slot = new Slot;

  constructor(public id: string) {}

  dispose() {
    this.disposing.emit();
    this.disposing.dispose();
  }

}

export class CollaborativeCursorManager {
  #cursors: Map<string, CollaborativeCursor> = new Map;

  public readonly onInserted: Slot<CollaborativeCursor> = new Slot;
  public readonly onRemoved: Slot<CollaborativeCursor> = new Slot;

  insert(cursor: CollaborativeCursor) {
    const { id } = cursor;
    if (this.#cursors.has(id)) {
      throw new Error("cursor has been inserted");
    }
    this.#cursors.set(id, cursor);

    cursor.disposing.on(() => {
      this.#cursors.delete(id);
      this.onRemoved.emit(cursor);
    });
    this.onInserted.emit(cursor);
  }

}
