import { BlockElement } from "@pkg/block/basic";
import Delta from "quill-delta-es";
import type { State, NodeLocation } from "./state";
import type { Operation } from "./operations";
import type {
  BlockyElement,
  BlockyTextModel,
  AttributesObject,
  BlockyNode,
} from "@pkg/model/tree";
import type { CursorState } from "./cursor";

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
  constructor(readonly state: State) {
    this.beforeCursor = state.cursorState;
  }
  setAttribute(node: BlockyElement, attributes: AttributesObject): Changeset {
    const oldAttributes = Object.create(null);
    for (const key in attributes) {
      const oldValue = node.getAttribute(key);
      oldAttributes[key] = oldValue;
    }
    const location = findNodeLocation(this.state.root, node);
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
    const parentLoc = findNodeLocation(this.state.root, node);
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
    const parentLoc = findNodeLocation(this.state.root, parent);
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
    const parentLoc = findNodeLocation(this.state.root, parent);

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
    after?: BlockyNode
  ): Changeset {
    const parentLoc = findNodeLocation(this.state.root, parent);
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
    const parentLoc = findNodeLocation(this.state.root, parent);
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
    const location = findNodeLocation(this.state.root, textNode);
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
    const location = findNodeLocation(this.state.root, textNode);
    const invert = d.invert(oldDelta);
    this.push({
      type: "op-text-edit",
      delta: d,
      invert,
      location,
    });
    return this;
  }
  push(operation: Operation) {
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
  options: ChangesetApplyOptions;
}
