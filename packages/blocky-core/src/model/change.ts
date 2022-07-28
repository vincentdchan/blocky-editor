import Delta from "quill-delta-es";
import {
  type BlockyElement,
  type BlockyTextModel,
  type AttributesObject,
  type BlockyNode,
  type BlockElement,
  JSONNode,
} from "@pkg/model/tree";
import { NodeLocation } from "./location";
import { type Operation, transformOperation } from "./operations";
import type { State } from "./state";
import type { CursorState } from "./cursor";

export interface ChangesetApplyOptions {
  updateView: boolean;
  ignoreCursor: boolean;
  recordUndo: boolean;
  refreshCursor: boolean;
}

const defaultApplyOptions: ChangesetApplyOptions = {
  updateView: true,
  ignoreCursor: false,
  recordUndo: true,
  refreshCursor: false,
};

/*
 * Changeset can be applied repeatedly.
 */
export class Changeset {
  version: number;
  operations: Operation[] = [];
  beforeCursor: CursorState | null = null;
  afterCursor?: CursorState | null;
  forceUpdate = false;
  constructor(readonly state: State) {
    this.version = state.appliedVersion + 1;
    this.beforeCursor = state.cursorState;
  }
  setAttribute(node: BlockyElement, attributes: AttributesObject): Changeset {
    const oldAttributes = Object.create(null);
    for (const key in attributes) {
      const oldValue = node.getAttribute(key);
      oldAttributes[key] = oldValue;
    }
    const location = this.state.getLocationOfNode(node);
    this.push({
      type: "op-update-node",
      attributes,
      oldAttributes,
      location,
    });
    return this;
  }
  setCursorState(cursorState: CursorState | null): Changeset {
    this.afterCursor = cursorState;
    return this;
  }
  appendChild(node: BlockyElement, child: BlockyNode): Changeset {
    const parentLoc = this.state.getLocationOfNode(node);
    const index = node.childrenLength;
    this.push({
      type: "op-insert-node",
      location: new NodeLocation([...parentLoc.path, index]),
      children: [child.toJSON()],
    });
    return this;
  }
  removeChild(parent: BlockyElement, child: BlockyNode): Changeset {
    const parentLoc = this.state.getLocationOfNode(parent);
    const index = parent.indexOf(child);
    this.push({
      type: "op-remove-node",
      location: new NodeLocation([...parentLoc.path, index]),
      children: [child.toJSON()],
    });
    return this;
  }
  deleteChildrenAt(
    parent: BlockyElement,
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
      type: "op-remove-node",
      location: new NodeLocation([...parentLoc.path, index]),
      children,
    });
    return this;
  }
  insertChildrenAfter(
    parent: BlockyElement,
    children: BlockyNode[],
    after?: BlockyNode | null
  ): Changeset {
    const parentLoc = this.state.getLocationOfNode(parent);
    let index = 0;
    if (after) {
      index = parent.indexOf(after) + 1;
    }
    this.push({
      type: "op-insert-node",
      location: new NodeLocation([...parentLoc.path, index]),
      children: children.map((child) => child.toJSON()),
    });
    return this;
  }
  insertChildrenAt(
    parent: BlockyElement,
    index: number,
    children: BlockyNode[]
  ): Changeset {
    const parentLoc = this.state.getLocationOfNode(parent);
    this.push({
      type: "op-insert-node",
      location: new NodeLocation([...parentLoc.path, index]),
      children: children.map((child) => child.toJSON()),
    });
    return this;
  }
  textEdit(
    node: BlockElement,
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
      type: "op-text-edit",
      location,
      id: node.id,
      key: propName,
      delta: d,
      invert,
    });
    return this;
  }
  textConcat(
    node: BlockElement,
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
      type: "op-text-edit",
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
    if (len > 0 && operation.type === "op-text-edit") {
      const last = this.operations[len - 1];
      if (last.type === "op-text-edit" && operation.id === last.id) {
        last.delta = last.delta.compose(operation.delta);
        last.invert = operation.invert.compose(last.invert);
      }
      return;
    }
    this.operations.push(operation);
  }
  apply(options?: Partial<ChangesetApplyOptions>) {
    const finalizedChangeset = this.finalize(options);
    if (finalizedChangeset.operations.length === 0) {
      return;
    }
    this.state.apply(finalizedChangeset);
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
