import { TreeEvent } from "@pkg/model/events";

/**
 * A stack item is used to store
 * a lot of operations commited by the user.
 *
 * The data stored in the object is used
 * to restore when the user trigger undo.
 *
 * A stack item has a property named `sealed`.
 * When a StackItem is sealed, it can't be
 * changed anymore.
 */
export class StackItem {
  prevSibling: StackItem | null = null;
  nextSibling: StackItem | null = null;
  sealed = false;
  readonly events: TreeEvent[] = [];

  seal() {
    this.sealed = true;
  }

  push(evt: TreeEvent) {
    if (this.sealed) {
      throw new Error("StackItem is sealed.");
    }
    this.events.push(evt);
  }
}

export class FixedSizeStack {
  #begin: StackItem | null = null;
  #end: StackItem | null = null;
  #length = 0;

  constructor(private maxSize: number) {}

  push(item: StackItem) {
    if (this.length >= this.maxSize) {
      this.pop();
    }
    if (!this.#begin) {
      this.#begin = item;
      this.#end = item;
    } else {
      item.nextSibling = this.#begin;
      item.prevSibling = null;
      this.#begin = item;
    }
    this.#length++;
  }

  peek(): StackItem | null {
    return this.#begin;
  }

  pop(): StackItem | void {
    if (this.#length === 0) {
      return;
    }
    const first = this.#begin!;
    this.#begin = first.nextSibling;
    if (this.#end === first) {
      this.#end = null;
    }

    this.#length--;
    return first;
  }

  get length() {
    return this.#length;
  }
}

export class UndoManager {
  readonly undoStack: FixedSizeStack;
  readonly redoStack: FixedSizeStack;

  constructor(stackSize: number = 20) {
    this.undoStack = new FixedSizeStack(stackSize);
    this.redoStack = new FixedSizeStack(stackSize);
  }

  getAUndoItem(): StackItem {
    const peek = this.undoStack.peek();
    if (peek && !peek.sealed) {
      return peek;
    }
    const newItem = new StackItem();
    this.undoStack.push(newItem);
    return newItem;
  }

  undo() {}

  redo() {}
}
