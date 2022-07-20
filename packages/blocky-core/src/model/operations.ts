import Delta from "quill-delta-es";
import type { AttributesObject } from "./element";
import type { NodeLocation } from "./state";

export interface InsertNodeOperation {
  type: "op-insert-node";
  parentLoc: NodeLocation;
}

export interface UpdateNodeOperation {
  type: "op-update-node";
  location: NodeLocation;
  attributes: AttributesObject;
}

export interface RemoveNodeOperation {
  type: "op-remove-node";
  location: NodeLocation;
}

export interface TextEditOperation {
  type: "op-text-edit";
  newDelta: Delta;
  oldDelta: Delta;
}

export type Operation =
  | InsertNodeOperation
  | UpdateNodeOperation
  | RemoveNodeOperation
  | UpdateNodeOperation;
