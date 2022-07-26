import Delta from "quill-delta-es";
import type { AttributesObject, JSONNode } from "@pkg/model/tree";
import type { NodeLocation } from "./location";

export interface InsertNodeOperation {
  type: "op-insert-node";
  parentLoc: NodeLocation;
  index: number;
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
  parentLoc: NodeLocation;
  index: number;
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
        parentLoc: op.parentLoc,
        index: op.index,
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
        parentLoc: op.parentLoc,
        index: op.index,
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
