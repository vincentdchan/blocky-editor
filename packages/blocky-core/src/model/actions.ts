import type { Span } from "@pkg/model/nodes";
import { type AttributesObject } from "@pkg/model/textModel";

export interface NewBlockAction {
  type: "new-block";
  blockName: string;
  targetId: string;
  afterId: string;
  newId: string;
  spans?: Span[];
  data?: any;
}

export interface DeleteLineAction {
  type: "delete";
  targetId: string;
}


export interface SetLineTypeAction {
  type: "set-line-type";
  targetId: string;
}

export interface TextFormatAction {
  type: "text-format";
  targetId: string;
  index: number;
  length: number;
  attributes?: AttributesObject;
}

export interface TextInsertAction {
  type: "text-insert";
  targetId: string;
  index: number;
  content: string;
  attributes?: AttributesObject;
}

export interface TextDeleteAction {
  type: "text-delete";
  targetId: string;
  index: number;
  length: number;
}

export type Action =
  | NewBlockAction
  | DeleteLineAction
  | SetLineTypeAction
  | TextFormatAction
  | TextInsertAction
  | TextDeleteAction;

export interface Transaction {
  actions: Action[];
}
