export interface AttributesObject {
  [key: string]: any;
}

export interface IModelElement {
  type: "element";
  nodeName: string;
  parent?: IModelElement;
  nextSibling?: IModelChild;
  prevSibling?: IModelChild;
  firstChild?: IModelChild;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | undefined;
}

export interface IModelText {
  type: "text";
  parent?: IModelElement;
  format(index: number, length: number, attributes?: AttributesObject): void;
  insert(index: number, text: string, attributes?: AttributesObject): void;
  delete(index: number, length: number): void;
  get length(): number;
}

export type IModelChild =
  | IModelElement
  | IModelText
