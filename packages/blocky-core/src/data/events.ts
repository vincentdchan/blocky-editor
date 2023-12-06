import type { DataBaseNode } from "./tree";

export interface ElementSetAttributeEvent {
  type: "element-set-attrib";
  key: string;
  value: any;
  oldValue?: any;
  source?: string;
}

export interface ElementRemoveChildEvent {
  type: "element-remove-child";
  parent: DataBaseNode;
  child: DataBaseNode;
  index: number;
  source?: string;
}

export interface ElementInsertChildEvent {
  type: "element-insert-child";
  parent: DataBaseNode;
  child: DataBaseNode;
  index: number;
  source?: string;
}

export type ElementChangedEvent =
  | ElementSetAttributeEvent
  | ElementInsertChildEvent
  | ElementRemoveChildEvent;
