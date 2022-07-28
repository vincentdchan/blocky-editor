import Delta from "quill-delta-es";
import { NodeLocation } from "./location";
import type { AttributesObject, JSONNode } from "@pkg/model/tree";
import { CursorState } from "./cursor";

export interface InsertNodeOperation {
  type: "op-insert-node";
  location: NodeLocation;
  children: JSONNode[];
}

export interface UpdateNodeOperation {
  type: "op-update-node";
  location: NodeLocation;
  attributes: AttributesObject;
  oldAttributes: AttributesObject;
}

export interface RemoveNodeOperation {
  type: "op-remove-node";
  location: NodeLocation;
  children: JSONNode[];
}

export interface TextEditOperation {
  type: "op-text-edit";
  location: NodeLocation;
  id: string;
  key: string;
  delta: Delta;
  invert: Delta;
}

export type Operation =
  | InsertNodeOperation
  | UpdateNodeOperation
  | RemoveNodeOperation
  | TextEditOperation;

export function invertOperation(op: Operation): Operation {
  switch (op.type) {
    case "op-insert-node": {
      return {
        type: "op-remove-node",
        location: op.location,
        children: op.children,
      };
    }
    case "op-text-edit": {
      return {
        type: "op-text-edit",
        location: op.location,
        id: op.id,
        key: op.key,
        delta: op.invert,
        invert: op.delta,
      };
    }
    case "op-remove-node": {
      return {
        type: "op-insert-node",
        location: op.location,
        children: op.children,
      };
    }
    case "op-update-node": {
      return {
        type: "op-update-node",
        location: op.location,
        attributes: op.oldAttributes,
        oldAttributes: op.attributes,
      };
    }
  }
}

export function transformOperation(a: Operation, b: Operation): Operation {
  if (a.type === "op-insert-node") {
    const newLocation = NodeLocation.transform(
      a.location,
      b.location,
      a.children.length
    );
    return {
      ...b,
      location: newLocation,
    };
  } else if (a.type === "op-remove-node") {
    const newLocation = NodeLocation.transform(
      a.location,
      b.location,
      a.children.length * -1
    );
    return {
      ...b,
      location: newLocation,
    };
  } else if (a.type === "op-text-edit" && b.type === "op-text-edit") {
    if (NodeLocation.equals(a.location, b.location) && a.key === b.key) {
      return {
        ...b,
        delta: a.delta.transform(b.delta),
        invert: a.delta.transform(b.invert),
      };
    }
  }
  return b;
}

export function transformCursorState(
  base: Operation,
  cursorState: CursorState | null
): CursorState | null {
  if (cursorState === null) {
    return cursorState;
  }

  if (
    base.type === "op-text-edit" &&
    cursorState.isCollapsed &&
    cursorState.endId == base.id
  ) {
    const transformedOffset = base.delta.transformPosition(
      cursorState.endOffset
    );
    if (transformedOffset !== cursorState.endOffset) {
      return CursorState.collapse(cursorState.endId, transformedOffset);
    }
  }

  return cursorState;
}
