import { isUndefined } from "lodash-es";
import { Changeset } from "./change";
import { CursorState } from "./cursor";
import { type Operation, invertOperation } from "./operations";
import type { State } from "./state";

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
export class HistoryItem {
  prevSibling: HistoryItem | null = null;
  nextSibling: HistoryItem | null = null;
  cursorState?: CursorState | null = null;
  sealed = false;
  readonly operations: Operation[] = [];

  seal() {
    this.sealed = true;
  }

  push(...operations: Operation[]) {
    if (this.sealed) {
      throw new Error("StackItem is sealed.");
    }
    this.operations.push(...operations);
  }

  toChangeset(state: State): Changeset {
    const result = new Changeset(state);
    for (let i = this.operations.length - 1; i >= 0; i--) {
      const item = this.operations[i];
      result.push(invertOperation(item));
    }
    if (!isUndefined(this.cursorState)) {
      result.setCursorState(this.cursorState);
    }
    return result;
  }
}

export class FixedSizeStack {
  #begin: HistoryItem | null = null;
  #end: HistoryItem | null = null;
  #length = 0;

  constructor(private maxSize: number) {}

  push(item: HistoryItem) {
    if (this.length >= this.maxSize) {
      this.#removeFirst();
    }
    if (!this.#end) {
      this.#begin = item;
      this.#end = item;
    } else {
      this.#end.nextSibling = item;
      item.prevSibling = this.#end;
      this.#end = item;
    }
    this.#length++;
  }

  peek(): HistoryItem | null {
    return this.#end;
  }

  #removeFirst() {
    if (this.#length === 0) {
      return;
    }
    const first = this.#begin!;
    this.#begin = first.nextSibling;
    if (this.#end === first) {
      this.#end = null;
    }

    this.#length--;
    first.prevSibling = null;
    first.nextSibling = null;
    return first;
  }

  pop(): HistoryItem | void {
    if (this.#length === 0) {
      return;
    }
    const last = this.#end!;
    this.#end = last.prevSibling;
    if (this.#begin === last) {
      this.#begin = null;
    }

    this.#length--;
    return last;
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
  /**
   * When the composition started, the current cursorState
   * is saved here.
   * When a text edit is committed, the value will be
   * consumed by the [UndoManager].
   *
   * This is not a good solution because the text committed
   * maybe not be the text which is pointed by the cursor.
   */
  cursorBeforeComposition: CursorState | null = null;

  readonly undoStack: FixedSizeStack;
  readonly redoStack: FixedSizeStack;

  constructor(readonly state: State, stackSize = 20) {
    this.undoStack = new FixedSizeStack(stackSize);
    this.redoStack = new FixedSizeStack(stackSize);
  }

  getAUndoItem(): HistoryItem {
    const peek = this.undoStack.peek();
    if (peek && !peek.sealed) {
      return peek;
    }
    const newItem = new HistoryItem();
    newItem.cursorState = this.state.cursorState;
    this.undoStack.push(newItem);
    return newItem;
  }

  seal() {
    const peek = this.undoStack.peek();
    if (peek) {
      peek.seal();
    }
  }

  undo(): HistoryItem | void {
    const item = this.undoStack.pop();
    if (!item) {
      return;
    }
    this.#undoStackItem(item);
    return item;
  }

  #undoStackItem(stackItem: HistoryItem) {
    const changeset = stackItem.toChangeset(this.state);
    changeset.apply({
      recordUndo: false,
    });
  }

  redo() {}
}
