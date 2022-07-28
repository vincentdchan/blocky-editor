import {
  Changeset,
  ChangesetApplyOptions,
  ChangesetRecordOption,
  FinalizedChangeset,
} from "./change";
import { CursorState } from "./cursor";
import { invertOperation } from "./operations";
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
  startVersion = -1;
  length = 0;

  seal() {
    this.sealed = true;
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

  pushRedoItem(changeset: FinalizedChangeset) {
    const newItem = new HistoryItem();
    newItem.cursorState = this.state.cursorState;
    newItem.startVersion = changeset.version;
    newItem.length = 1;
    this.redoStack.push(newItem);
  }

  clearRedoStack() {
    this.redoStack.clear();
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
    const changeset = new Changeset(this.state);

    for (let i = stackItem.length - 1; i >= 0; i--) {
      const v = stackItem.startVersion + i;
      const item = this.#invertChangeset(this.state.versionHistory.get(v)!);
      const rebasedItem = this.state.rebase(item);
      changeset.append(rebasedItem);
    }

    changeset.apply({
      record: ChangesetRecordOption.Redo,
    });
  }

  #invertChangeset(
    changeset: FinalizedChangeset,
    options?: Partial<ChangesetApplyOptions>
  ): FinalizedChangeset {
    const invertedChange = new Changeset(this.state);
    invertedChange.version = changeset.version + 1;
    invertedChange.afterCursor = changeset.beforeCursor;
    invertedChange.beforeCursor = changeset.afterCursor ?? null;

    for (let i = changeset.operations.length - 1; i >= 0; i--) {
      invertedChange.pushWillMerge(invertOperation(changeset.operations[i]));
    }

    return invertedChange.finalize(options);
  }

  redo() {
    const redoItem = this.redoStack.pop();
    if (!redoItem) {
      return;
    }
    const changeset = this.state.versionHistory.get(redoItem.startVersion)!;
    let invertedChange = this.#invertChangeset(changeset, {
      record: ChangesetRecordOption.None,
    });
    invertedChange = this.state.rebase(invertedChange, {
      record: ChangesetRecordOption.None,
    });
    this.state.apply(invertedChange);
  }
}
