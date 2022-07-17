import type { AttributesObject, BlockyNode } from "./element";

export interface TextInsertEvent {
  type: "text-insert";
  index: number;
  text: string;
  attributes?: AttributesObject;
}

export interface TextDeleteEvent {
  type: "text-delete";
  index: number;
  length: number;
}

export interface TextFormatEvent {
  type: "text-format";
  index: number;
  length: number;
  attributes?: AttributesObject;
}

export type TextChangedEvent =
  | TextInsertEvent
  | TextDeleteEvent
  | TextFormatEvent;

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
  getInsertIndex: () => number;
}

export interface ElementInsertChildEvent {
  type: "element-insert-child";
  parent: BlockyNode;
  child: BlockyNode;
  getInsertIndex: () => number;
}

export type ElementChangedEvent =
  | ElementSetAttributeEvent
  | ElementInsertChildEvent
  | ElementRemoveChildEvent;

export type TreeEvent = TextChangedEvent | ElementChangedEvent;
