import { type IModelElement } from "@pkg/model";

export interface NewBlockAction {
  type: "new-block";
  blockName: string;
  targetId: string;
  afterId: string;
  newId: string;
  data?: IModelElement;
}

export interface DeleteLineAction {
  type: "delete";
  targetId: string;
}

export type Action =
  | NewBlockAction
  | DeleteLineAction

export interface Transaction {
  actions: Action[];
}
