import type { ElementChangedEvent } from "./events";
import type { JSONNode, AttributesObject, BlockyNode } from "./element";
import type { State } from "./state";
import { BlockyElement, BlockyTextModel } from "./tree";
import { BlockElement } from "..";

interface NodeLocation {
  id?: string;
  path: number[];
}

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

export interface TextInsertOperation {
  type: "op-text-insert";
  location: NodeLocation;
  text: string;
  attributes?: AttributesObject;
}

export interface TextFormatOperation {
  type: "op-text-format";
  location: NodeLocation;
}

export interface TextDeleteOperation {
  type: "op-text-delete";
  location: NodeLocation;
}

export type Operation =
  | InsertNodeOperation
  | DeleteNodeOperation
  | UpdateNodeOperation
  | TextInsertOperation
  | TextFormatOperation
  | TextDeleteOperation;

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

export class UndoManager {
  /**
   * Indicates whether the [UndoManager] is working
   */
  recording = true;

  readonly undoStack: FixedSizeStack;
  readonly redoStack: FixedSizeStack;

  constructor(readonly state: State, stackSize = 20) {
    this.undoStack = new FixedSizeStack(stackSize);
    this.redoStack = new FixedSizeStack(stackSize);

    this.#listenOnState();
  }

  #listenOnState() {
    this.#bindBlockyNode(this.state.root);
  }

  #bindBlockyNode(element: BlockyElement) {
    element.changed.on((evt: ElementChangedEvent) => {
      if (!this.recording) {
        return;
      }

      const stackItem = this.getAUndoItem();

      if (evt.type === "element-insert-child") {
        const { child, parent, index } = evt;
        const parentLoc = findNodeLocation(this.state.root, parent);
        stackItem.push({
          type: "op-insert-node",
          parentLoc,
          index,
        });
        if (child instanceof BlockyElement) {
          this.#bindBlockyNode(child);
        } else if (child instanceof BlockyTextModel) {
          this.#bindBlockyTextModel(child);
        }
      } else if (evt.type === "element-set-attrib") {
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
      } else if (evt.type === "element-remove-child") {
        const parentLoc = findNodeLocation(this.state.root, evt.parent);
        const snapshot = evt.child.toJSON();
        stackItem.push({
          type: "op-delete-node",
          parentLoc,
          index: evt.index,
          snapshot,
        });
      }
    });
  }

  #bindBlockyTextModel(blockyText: BlockyTextModel) {}

  getAUndoItem(): StackItem {
    const peek = this.undoStack.peek();
    if (peek && !peek.sealed) {
      return peek;
    }
    const newItem = new StackItem();
    this.undoStack.push(newItem);
    return newItem;
  }

  seal() {
    const peek = this.undoStack.peek();
    if (peek) {
      peek.seal();
    }
  }

  undo() {
    const item = this.undoStack.pop();
    if (!item) {
      return;
    }
    this.#undoStackItem(item);
  }

  #undoStackItem(stackItem: StackItem) {
    console.log("redo", stackItem);
  }

  redo() {}
}
