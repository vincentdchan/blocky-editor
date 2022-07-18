import { AttributesObject, JSONNode } from "./element";

export interface InsertOperation {
  type: "insert-operation";
  parentId?: string;
  path: number[];
}

export interface DeleteOperation {
  type: "delete-operation";
  parentId?: string;
  path: number[];
  snapshot: JSONNode;
}

export interface UpdateAttributeOperation {
  type: "update-attribute-operation";
  id: string;
  path: number[];
  newAttributes: AttributesObject;
  oldAttributes: AttributesObject;
}

export type Operation =
  | InsertOperation
  | UpdateAttributeOperation
  | DeleteOperation;

/**
 * A stack item is used to store
 * a lot of operations committed by the user.
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
  readonly operations: Operation[] = [];

  seal() {
    this.sealed = true;
  }

  push(operation: Operation) {
    if (this.sealed) {
      throw new Error("StackItem is sealed.");
    }
    this.operations.push(operation);
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

  clear() {
    this.#begin = null;
    this.#end = null;
    this.#length = 0;
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
