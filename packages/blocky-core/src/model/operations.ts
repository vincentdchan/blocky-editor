import Delta from "quill-delta-es";
import { NodeLocation } from "./location";
import type { AttributesObject, JSONNode } from "blocky-data";
import { CursorState } from "./cursor";

export interface InsertNodeOperation {
  op: "insert-nodes";
  location: NodeLocation;
  children: JSONNode[];
}

export interface UpdateNodeOperation {
  op: "update-attributes";
  location: NodeLocation;
  attributes: AttributesObject;
  oldAttributes: AttributesObject;
}

export interface RemoveNodeOperation {
  op: "remove-nodes";
  location: NodeLocation;
  children: JSONNode[];
}

export interface TextEditOperation {
  op: "text-edit";
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

export function invertOperation(operation: Operation): Operation {
  switch (operation.op) {
    case "insert-nodes": {
      return {
        op: "remove-nodes",
        location: operation.location,
        children: operation.children,
      };
    }
    case "text-edit": {
      return {
        op: "text-edit",
        location: operation.location,
        id: operation.id,
        key: operation.key,
        delta: operation.invert,
        invert: operation.delta,
      };
    }
    case "remove-nodes": {
      return {
        op: "insert-nodes",
        location: operation.location,
        children: operation.children,
      };
    }
    case "update-attributes": {
      return {
        op: "update-attributes",
        location: operation.location,
        attributes: operation.oldAttributes,
        oldAttributes: operation.attributes,
      };
    }
  }
}

export function transformOperation(a: Operation, b: Operation): Operation {
  if (a.op === "insert-nodes") {
    const newLocation = NodeLocation.transform(
      a.location,
      b.location,
      a.children.length
    );
    return {
      ...b,
      location: newLocation,
    };
  } else if (a.op === "remove-nodes") {
    const newLocation = NodeLocation.transform(
      a.location,
      b.location,
      a.children.length * -1
    );
    return {
      ...b,
      location: newLocation,
    };
  } else if (a.op === "text-edit" && b.op === "text-edit") {
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
    base.op === "text-edit" &&
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
