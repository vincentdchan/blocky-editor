import Delta from "quill-delta-es";
import type { AttributesObject, BlockyNode } from "./element";
import type { NodeLocation } from "./state";

export interface InsertNodeOperation {
  type: "op-insert-node";
  parentLoc: NodeLocation;
  index: number;
  children: BlockyNode[];
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
  children: BlockyNode[];
}

export interface TextEditOperation {
  type: "op-text-edit";
  location: NodeLocation;
  newDelta: Delta;
  oldDelta: Delta;
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
        oldDelta: op.newDelta,
        newDelta: op.oldDelta,
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
