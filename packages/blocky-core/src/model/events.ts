import type { BlockyNode } from "./element";

export interface ElementSetAttributeEvent {
  type: "element-set-attrib";
  key: string;
  value: string;
  oldValue?: string;
}

export interface ElementRemoveChildEvent {
  type: "element-remove-child";
  parent: BlockyNode;
  child: BlockyNode;
  index: number;
}

export interface ElementInsertChildEvent {
  type: "element-insert-child";
  parent: BlockyNode;
  child: BlockyNode;
  index: number;
}

export type ElementChangedEvent =
  | ElementSetAttributeEvent
  | ElementInsertChildEvent
  | ElementRemoveChildEvent;
