import Delta from "quill-delta-es";
import {
  type DataBaseElement,
  type BlockyTextModel,
  type AttributesObject,
  type DataBaseNode,
  type BlockDataElement,
  JSONNode,
  DataNode,
} from "./tree";
import {
  type Operation,
  transformOperation,
  type OperationMessage,
  operationToMessage,
  operationFromMessage,
} from "./operations";
import { NodeLocation } from "./location";
import type { CursorState } from "./cursor";

export enum ChangesetRecordOption {
  Undo = 0,
  Redo = 1,
  None = 2,
}

export interface ChangesetApplyOptions {
  updateView: boolean;
  ignoreCursor: boolean;
  record: ChangesetRecordOption;
  refreshCursor: boolean;
}

const defaultApplyOptions: ChangesetApplyOptions = {
  updateView: true,
  ignoreCursor: false,
  record: ChangesetRecordOption.Undo,
  refreshCursor: false,
};

export interface ChangesetStateLogger {
  userId: string;
  get appliedVersion(): number;
  get cursorState(): CursorState | null;
  getLocationOfNode(node: DataBaseNode): NodeLocation;
  apply(changeset: FinalizedChangeset): void;
}

/**
 * Changeset is a collection of changes which can be
 * applied to the document's state.
 *
 * Each changeset has it's own ID.
 * So it can be applied repeatedly.
 */
export class Changeset {
  version: number;
  operations: Operation[] = [];
  beforeCursor: CursorState | null = null;
  afterCursor?: CursorState | null;
  forceUpdate = false;

  constructor(readonly state: ChangesetStateLogger) {
    this.version = state.appliedVersion + 1;
    this.beforeCursor = state.cursorState;
  }

  /**
   * Update the attributes of a `BlockyNode`.
   */
  updateAttributes(
    node: DataBaseElement,
    attributes: AttributesObject
  ): Changeset {
    const oldAttributes = Object.create(null);
    for (const key in attributes) {
      const oldValue = node.getAttribute(key);
      oldAttributes[key] = oldValue;
    }
    const location = this.state.getLocationOfNode(node);
    this.push({
      op: "update-attributes",
      attributes,
      oldAttributes,
      location,
    });
    return this;
  }

  /**
   * Set the cursor after the changeset is applied.
   */
  setCursorState(cursorState: CursorState | null): Changeset {
    this.afterCursor = cursorState;
    return this;
  }

  /**
   * Append a node at the end of another node.
   */
  appendChild(node: DataNode, child: DataBaseNode): Changeset {
    const parentLoc = this.state.getLocationOfNode(node);
    const index = node.childrenLength;
    this.push({
      op: "insert-nodes",
      location: new NodeLocation([...parentLoc.path, index]),
      children: [child.toJSON()],
    });
    return this;
  }

  removeChild(parent: DataBaseElement, child: DataBaseNode): Changeset {
    const parentLoc = this.state.getLocationOfNode(parent);
    const index = parent.indexOf(child);
    this.push({
      op: "remove-nodes",
      location: new NodeLocation([...parentLoc.path, index]),
      children: [child.toJSON()],
    });
    return this;
  }

  /**
   * Remove a node from the parent.
   */
  removeNode(node: DataBaseNode): Changeset {
    return this.removeChild(node.parent!, node);
  }

  /**
   * Delete a sequences of children of a node.
   */
  deleteChildrenAt(
    parent: DataBaseElement,
    index: number,
    count: number
  ): Changeset {
    if (count === 0) {
      return this;
    }
    const parentLoc = this.state.getLocationOfNode(parent);

    let child = parent.childAt(index);
    if (child == null) {
      return this;
    }

    const children: JSONNode[] = [];
    while (child && count > 0) {
      children.push(child.toJSON());
      child = child.nextSibling;
      count--;
    }

    this.push({
      op: "remove-nodes",
      location: new NodeLocation([...parentLoc.path, index]),
      children,
    });
    return this;
  }

  /**
   * Insert a sequences of children after another node.
   */
  insertChildrenAfter(
    parent: DataBaseElement,
    children: DataBaseNode[],
    after?: DataBaseNode | null
  ): Changeset {
    const parentLoc = this.state.getLocationOfNode(parent);
    let index = 0;
    if (after) {
      index = parent.indexOf(after) + 1;
    }
    this.push({
      op: "insert-nodes",
      location: new NodeLocation([...parentLoc.path, index]),
      children: children.map((child) => child.toJSON()),
    });
    return this;
  }

  /**
   * Insert children at the position of a node.
   */
  insertChildrenAt(
    parent: DataBaseElement,
    index: number,
    children: DataBaseNode[]
  ): Changeset {
    const parentLoc = this.state.getLocationOfNode(parent);
    this.push({
      op: "insert-nodes",
      location: new NodeLocation([...parentLoc.path, index]),
      children: children.map((child) => child.toJSON()),
    });
    return this;
  }

  /**
   * Apply the quill delta to the BlockyNode.
   * For a `Text` block, the `propName` is usually called `textContent`.
   */
  textEdit(
    node: BlockDataElement,
    propName: string,
    delta: () => Delta
  ): Changeset {
    const d = delta();
    if (d.ops.length === 0) {
      return this;
    }
    const location = this.state.getLocationOfNode(node);
    const textModel = node.getAttribute(propName) as BlockyTextModel;

    const oldDelta = textModel.delta;
    const invert = d.invert(oldDelta);
    this.push({
      op: "text-edit",
      location,
      id: node.id,
      key: propName,
      delta: d,
      invert,
    });
    return this;
  }

  textConcat(
    node: BlockDataElement,
    propName: string,
    delta: () => Delta
  ): Changeset {
    let d = delta();
    if (d.ops.length === 0) {
      return this;
    }
    const location = this.state.getLocationOfNode(node);
    const textModel = node.getAttribute(propName) as BlockyTextModel;
    const oldDelta = textModel.delta;

    d = new Delta().retain(oldDelta.length()).concat(d);
    const invert = d.invert(oldDelta);
    this.push({
      op: "text-edit",
      location,
      id: node.id,
      key: propName,
      delta: d,
      invert,
    });
    return this;
  }

  /**
   * This method will transform path.
   * If you don't want to transform path, call [pushWillMerge].
   */
  push(operation: Operation) {
    for (let i = 0; i < this.operations.length; i++) {
      const item = this.operations[i];
      operation = transformOperation(item, operation);
    }
    this.pushWillMerge(operation);
  }

  pushWillMerge(operation: Operation) {
    // TODO: test
    const len = this.operations.length;
    if (len > 0 && operation.op === "text-edit") {
      const last = this.operations[len - 1];
      if (last.op === "text-edit" && operation.id === last.id) {
        last.delta = last.delta.compose(operation.delta);
        last.invert = operation.invert.compose(last.invert);
        return;
      }
    }
    this.operations.push(operation);
  }

  /**
   * Apply this changeset to the `EditorState`.
   * The editor will render automatically after the changeset is applied.
   */
  apply(options?: Partial<ChangesetApplyOptions>): FinalizedChangeset | void {
    const finalizedChangeset = this.finalize(options);
    if (finalizedChangeset.operations.length === 0) {
      return;
    }
    this.state.apply(finalizedChangeset);
    return finalizedChangeset;
  }

  finalize(options?: Partial<ChangesetApplyOptions>): FinalizedChangeset {
    const result: FinalizedChangeset = {
      userId: this.state.userId,
      version: this.version,
      operations: this.operations,
      beforeCursor: this.beforeCursor,
      afterCursor: this.afterCursor,
      forceUpdate: this.forceUpdate,
      options: {
        ...defaultApplyOptions,
        ...options,
      },
    };
    this.operations = [];
    return result;
  }

  /**
   * @param that Can be either a [Changeset] or a [FinalizedChangeset]
   */
  append(that: Changeset | FinalizedChangeset) {
    // do NOT call `this.push` because the operations do NOT need changes.
    // TODO: add a method to merge
    that.operations.forEach((op) => this.pushWillMerge(op));
    this.afterCursor = that.afterCursor;
  }
}

export interface FinalizedChangeset {
  userId: string;
  version: number;
  operations: Operation[];
  beforeCursor: CursorState | null;
  afterCursor?: CursorState | null;
  forceUpdate: boolean;
  options: ChangesetApplyOptions;
}

/**
 * A changeset interface used to transmit.
 * Can be serialized as JSON.
 */
export interface ChangesetMessage {
  userId: string;
  version: number;
  operations: OperationMessage[];
  beforeCursor: CursorState | null;
  afterCursor?: CursorState | null;
  forceUpdate: boolean;
  options: ChangesetApplyOptions;
}

/**
 * Convert a {@link FinalizedChangeset} to {@link ChangesetMessage}.
 */
export function changesetToMessage(
  changeset: FinalizedChangeset
): ChangesetMessage {
  return {
    ...changeset,
    operations: changeset.operations.map(operationToMessage),
  };
}

/**
 * Convert a {@link ChangesetMessage} to {@link FinalizedChangeset}.
 */
export function changesetFromMessage(
  msg: ChangesetMessage
): FinalizedChangeset {
  return {
    ...msg,
    operations: msg.operations.map(operationFromMessage),
  };
}
