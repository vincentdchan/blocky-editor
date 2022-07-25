import Delta from "quill-delta-es";
import {
  type BlockyElement,
  type BlockyTextModel,
  type AttributesObject,
  type BlockyNode,
} from "@pkg/model/tree";
import { type State, NodeLocation } from "./state";
import type { Operation } from "./operations";
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

export class Changeset {
  operations: Operation[] = [];
  beforeCursor: CursorState | null = null;
  afterCursor?: CursorState | null;
  forceUpdate = false;
  constructor(readonly state: State) {
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
      index,
      parentLoc,
      children: [child],
    });
    return this;
  }
  removeChild(parent: BlockyElement, child: BlockyNode): Changeset {
    const parentLoc = this.state.getLocationOfNode(parent);
    const index = parent.indexOf(child);
    this.push({
      type: "op-remove-node",
      parentLoc,
      index,
      children: [child],
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

    const children: BlockyNode[] = [];
    while (child && count > 0) {
      children.push(child);
      child = child.nextSibling;
      count--;
    }

    this.push({
      type: "op-remove-node",
      parentLoc,
      index,
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
      parentLoc,
      index,
      children,
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
      index,
      parentLoc,
      children,
    });
    return this;
  }
  textEdit(textNode: BlockyTextModel, delta: () => Delta): Changeset {
    const d = delta();
    if (d.ops.length === 0) {
      return this;
    }
    const oldDelta = textNode.delta;
    const location = this.state.getLocationOfNode(textNode);
    const invert = d.invert(oldDelta);
    this.push({
      type: "op-text-edit",
      delta: d,
      invert,
      location,
    });
    return this;
  }
  textConcat(textNode: BlockyTextModel, delta: () => Delta): Changeset {
    let d = delta();
    if (d.ops.length === 0) {
      return this;
    }
    const oldDelta = textNode.delta;
    d = new Delta().retain(oldDelta.length()).concat(d);
    const location = this.state.getLocationOfNode(textNode);
    const invert = d.invert(oldDelta);
    this.push({
      type: "op-text-edit",
      delta: d,
      invert,
      location,
    });
    return this;
  }
  /**
   * There is some merge mechanism there,
   * If there is
   *  - delete 1
   *  - delete 2
   *
   * Then the second op should be transformed, so we got:
   *  - delete 1
   *  - delete 1
   */
  push(operation: Operation) {
    if (operation.type === "op-remove-node") {
      for (let i = 0, len = this.operations.length; i < len; i++) {
        const op = this.operations[i];
        if (
          op.type === "op-remove-node" &&
          NodeLocation.equals(op.parentLoc, operation.parentLoc)
        ) {
          if (op.index < operation.index) {
            operation.index -= op.children.length;
          }
        }
      }
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
}

export interface FinalizedChangeset {
  operations: Operation[];
  beforeCursor: CursorState | null;
  afterCursor?: CursorState | null;
  forceUpdate: boolean;
  options: ChangesetApplyOptions;
}
