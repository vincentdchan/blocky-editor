export interface StackItem {
  prevSibling: StackItem | null;
  nextSibling: StackItem | null;
}

export class UndoManager {
  #begin: StackItem | null = null;
  #end: StackItem | null = null;
  #length: number = 0;

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
