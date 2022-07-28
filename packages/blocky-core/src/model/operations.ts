import Delta from "quill-delta-es";
import { NodeLocation } from "./location";
import type { AttributesObject, JSONNode } from "@pkg/model/tree";

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
