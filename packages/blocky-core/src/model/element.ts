import type { State } from "./state";

export interface AttributesObject {
  [key: string]: any;
}

export interface TextDelta {
  retain?: number;
  insert?: string;
  attributes?: any;
  delete?: number;
}

export interface JSONNode {
  nodeName: string;
  id?: string;
  textContent?: TextDelta[];
  attributes?: AttributesObject;
  children?: JSONChild[];
}

export type JSONChild = JSONNode;

export interface BlockyNode {
  state?: State;

  nodeName: string;
  parent: BlockyNode | null;
  nextSibling: BlockyNode | null;
  prevSibling: BlockyNode | null;
  firstChild: BlockyNode | null;
  lastChild: BlockyNode | null;
  childrenLength: number;

  clone(): BlockyNode;
  toJSON(): JSONNode;
}
