import Delta from "quill-delta-es";
import { isEqual } from "lodash-es";
import { BlockElement } from "@pkg/block/basic";
import { blockyNodeFromJsonNode } from "@pkg/model/deserialize";
import { BlockyElement, BlockyTextModel } from "./tree";
import type { ElementChangedEvent } from "./events";
import type { JSONNode, AttributesObject, BlockyNode } from "./element";
import type { State, NodeLocation } from "./state";
import { CursorState } from "./cursor";
import { Changeset } from "./change";

export interface InsertNodeOperation {
  type: "op-insert-node";
  parentLoc?: NodeLocation;
  index: number;
}

export interface DeleteNodeOperation {
  type: "op-delete-node";
  parentLoc: NodeLocation;
  index: number;
  snapshot: JSONNode;
}

export interface UpdateNodeOperation {
  type: "op-update-attributes";
  location: NodeLocation;
  newAttributes: AttributesObject;
  oldAttributes: AttributesObject;
}

export interface TextEditOperation {
  type: "op-text-edit";
  location: NodeLocation;
  newDelta: Delta;
  oldDelta: Delta;
}

export type Operation =
  | InsertNodeOperation
  | DeleteNodeOperation
  | UpdateNodeOperation
  | TextEditOperation;

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
  cursorState: CursorState | undefined = undefined;
  sealed = false;
  readonly operations: Operation[] = [];

  seal() {
    this.sealed = true;
  }

  push(operation: Operation, cursorState?: CursorState) {
    if (this.sealed) {
      throw new Error("StackItem is sealed.");
    }
    if (this.operations.length > 0 && operation.type === "op-text-edit") {
      const last = this.operations[this.operations.length - 1];
      if (
        last.type === "op-text-edit" &&
        isEqual(last.location, operation.location)
      ) {
        last.newDelta = operation.newDelta;
        // do NOT set the cursor state
        return;
      }
    }
    this.operations.push(operation);
    this.cursorState = cursorState;
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

function findNodeLocation(root: BlockyElement, node: BlockyNode): NodeLocation {
  if (root === node) {
    return { path: [] };
  }
  if (node instanceof BlockElement) {
    return {
      id: node.id,
      path: [],
    };
  }
  const parent = node.parent!;
  const parentPath = findNodeLocation(root, parent);

  let cnt = 0;
  let ptr = node.prevSibling;
  while (ptr) {
    cnt++;
    ptr = ptr.prevSibling;
  }

  parentPath.path.push(cnt);
  return parentPath;
}

enum UndoState {
  Pause = 0,
  Recording = 1,
  Undoing = 2,
  Redoing = 3,
}

export class UndoManager {
  /**
   * Indicates whether the [UndoManager] is working
   */
  undoState: UndoState = UndoState.Recording;

  /**
   * When the composition started, the current cursorState
   * is saved here.
   * When a text edit is committed, the value will be
   * consumed by the [UndoManager].
   *
   * This is not a good solution because the text summited
   * maybe not be the text which is pointed by the cursor.
   */
  cursorBeforeComposition: CursorState | undefined;

  readonly undoStack: FixedSizeStack;
  readonly redoStack: FixedSizeStack;

  constructor(readonly state: State, stackSize = 20) {
    this.undoStack = new FixedSizeStack(stackSize);
    this.redoStack = new FixedSizeStack(stackSize);

    this.#listenOnState();
  }

  get shouldRecord(): boolean {
    return this.undoState === UndoState.Recording;
  }

  pause() {
    if (this.undoState === UndoState.Recording) {
      this.undoState = UndoState.Pause;
    }
  }

  recover() {
    if (this.undoState === UndoState.Pause) {
      this.undoState = UndoState.Recording;
    }
  }

  #listenOnState() {
    this.#bindBlockyElement(this.state.root);
  }

  #bindBlockyNode(node: BlockyNode) {
    if (node instanceof BlockyElement) {
      this.#bindBlockyElement(node);
    } else if (node instanceof BlockyTextModel) {
      this.#bindBlockyTextModel(node);
    }
  }

  #bindBlockyElement(element: BlockyElement) {
    element.changed.on((evt: ElementChangedEvent) => {
      switch (evt.type) {
        case "element-insert-child": {
          const { child, parent, index } = evt;
          if (this.shouldRecord) {
            const stackItem = this.getAUndoItem();
            const parentLoc = findNodeLocation(this.state.root, parent);
            stackItem.push(
              {
                type: "op-insert-node",
                parentLoc,
                index,
              },
              this.state.cursorState
            );
          }
          this.#bindBlockyNode(child);
          break;
        }

        case "element-set-attrib": {
          if (this.shouldRecord) {
            const stackItem = this.getAUndoItem();
            const location = findNodeLocation(this.state.root, element);
            stackItem.push({
              type: "op-update-attributes",
              location,
              newAttributes: {
                [evt.key]: evt.value,
              },
              oldAttributes: {
                [evt.key]: evt.oldValue,
              },
            });
          }
          break;
        }

        case "element-remove-child": {
          if (this.shouldRecord) {
            const parentLoc = findNodeLocation(this.state.root, evt.parent);
            const stackItem = this.getAUndoItem();
            const snapshot = evt.child.toJSON();
            stackItem.push({
              type: "op-delete-node",
              parentLoc,
              index: evt.index,
              snapshot,
            });
          }
          break;
        }
      }
    });

    let ptr = element.firstChild;
    while (ptr) {
      this.#bindBlockyNode(ptr);
      ptr = ptr.nextSibling;
    }
  }

  #bindBlockyTextModel(textModel: BlockyTextModel) {
    const location = findNodeLocation(this.state.root, textModel);
    textModel.changed.on((evt) => {
      if (this.shouldRecord) {
        const stackItem = this.getAUndoItem();
        const { oldDelta, newDelta } = evt;
        stackItem.push(
          {
            type: "op-text-edit",
            location,
            newDelta,
            oldDelta,
          },
          this.state.cursorState
        );
        if (this.cursorBeforeComposition) {
          stackItem.cursorState = this.cursorBeforeComposition;
          this.cursorBeforeComposition = undefined;
        }
      }
    });
  }

  getAUndoItem(): HistoryItem {
    const peek = this.undoStack.peek();
    if (peek && !peek.sealed) {
      return peek;
    }
    const newItem = new HistoryItem();
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
    const prevState = this.undoState;
    this.undoState = UndoState.Undoing;
    try {
      const item = this.undoStack.pop();
      if (!item) {
        return;
      }
      this.#undoStackItem(item);
      return item;
    } finally {
      this.undoState = prevState;
    }
  }

  #undoStackItem(stackItem: HistoryItem) {
    for (let i = stackItem.operations.length - 1; i >= 0; i--) {
      this.#undoOperation(stackItem.operations[i]);
    }
  }

  #undoOperation(op: Operation) {
    switch (op.type) {
      case "op-text-edit": {
        this.#undoTextEditOperation(op);
        break;
      }
      case "op-insert-node": {
        this.#undoInsertNode(op);
        break;
      }
      case "op-delete-node": {
        this.#undoDeleteNode(op);
        break;
      }
    }
  }

  #undoTextEditOperation(textEdit: TextEditOperation) {
    const node = this.state.findNodeByLocation(textEdit.location);
    if (!(node instanceof BlockyTextModel)) {
      console.warn(
        `Node at the location is not a BlockyTextModel`,
        textEdit.location
      );
      return;
    }
    node.delta = textEdit.oldDelta;
  }

  #undoInsertNode(insertNodeOperation: InsertNodeOperation) {
    const { parentLoc, index } = insertNodeOperation;
    let parentNode: BlockyElement;
    if (parentLoc) {
      parentNode = this.state.findNodeByLocation(parentLoc) as BlockyElement;
    } else {
      parentNode = this.state.root;
    }

    const child = parentNode.childAt(index);
    if (child) {
      new Changeset(this.state).removeNode(parentNode, child).apply();
    }
  }

  #undoDeleteNode(deleteNodeOperation: DeleteNodeOperation) {
    const { parentLoc, snapshot, index } = deleteNodeOperation;
    const node = blockyNodeFromJsonNode(snapshot);
    let parentNode: BlockyElement;
    if (parentLoc) {
      parentNode = this.state.findNodeByLocation(parentLoc) as BlockyElement;
    } else {
      parentNode = this.state.root;
    }

    new Changeset(this.state).insertChildAt(parentNode, index, node).apply();
  }

  redo() {}
}
