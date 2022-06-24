import { type IModelElement } from "@pkg/model";

export interface NewBlockAction {
  type: "new-block";
  blockName: string;
  targetId: string;
  afterId: string;
  newId: string;
  data?: IModelElement;
}

export type Action =
  | NewBlockAction

export interface Transaction {
  actions: Action[];
}
