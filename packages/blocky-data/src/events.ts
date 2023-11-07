import type { DataBaseNode } from "./tree";

export interface ElementSetAttributeEvent {
  type: "element-set-attrib";
  key: string;
  value: string;
  oldValue?: string;
}

export interface ElementRemoveChildEvent {
  type: "element-remove-child";
  parent: DataBaseNode;
  child: DataBaseNode;
  index: number;
}

export interface ElementInsertChildEvent {
  type: "element-insert-child";
  parent: DataBaseNode;
  child: DataBaseNode;
  index: number;
}

export type ElementChangedEvent =
  | ElementSetAttributeEvent
  | ElementInsertChildEvent
  | ElementRemoveChildEvent;
