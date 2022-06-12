import type { Span } from "@pkg/model/nodes";
import type * as fastdiff from "fast-diff";

export interface NewBlockAction {
  type: "new-block";
  targetId: string;
  afterId: string;
  newId: string;
  spans?: Span[];
  data?: any;
}

export interface NewSpanAction {
  type: "new-span";
  targetId: string;
  afterId?: string;
  append?: boolean;
  content: Span;
}

export interface NewSubpageAction {
  type: "new-subpage";
  targetId?: string; // preserved
  title?: string;
  newId: string;
}

export interface DeleteLineAction {
  type: "delete";
  targetId: string;
}

export interface UpdateSpanAction {
  type: "update-span";
  targetId: string;
  value: Partial<Span>;
  diffs?: fastdiff.Diff[];
}

export interface SetLineTypeAction {
  type: "set-line-type";
  targetId: string;
}

export type Action =
  | NewBlockAction
  | DeleteLineAction
  | UpdateSpanAction
  | NewSpanAction
  | NewSubpageAction
  | SetLineTypeAction;

export interface Transaction {
  actions: Action[];
}
