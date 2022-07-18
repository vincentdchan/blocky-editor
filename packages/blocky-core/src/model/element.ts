import type { State } from "./state";
import type { Op } from "quill-delta-es";

export interface AttributesObject {
  [key: string]: any;
}

export interface JSONNode {
  nodeName: string;
  id?: string;
  textContent?: Op[];
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
