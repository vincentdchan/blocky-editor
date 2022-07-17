import { TreeEvent } from "@pkg/model/events";

export class StackItem {
  prevSibling: StackItem | null = null;
  nextSibling: StackItem | null = null;
  sealed = false;
  readonly events: TreeEvent[] = [];

  seal() {
    this.sealed = true;
  }

  push(evt: TreeEvent) {
    this.events.push(evt);
  }
}

export class FixedSizeStack {
  #begin: StackItem | null = null;
  #end: StackItem | null = null;
  #length = 0;

  push(item: StackItem) {
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
  readonly undoStack = new FixedSizeStack();
  readonly redoStack = new FixedSizeStack();

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
