import { type IModelElement, type IModelChild } from "./element";

// const bannedAttributesName: Set<string> = new Set([
//   "nodeName",
//   "type",
// ]);

export class ElementModel implements IModelElement {
  type: "element" = "element";
  parent?: IModelElement;
  nextSibling?: IModelChild;
  prevSibling?: IModelChild;
  
  get firstChild(): IModelChild | undefined {
    return this.#firstChild;
  }

  #firstChild?: IModelChild;
  #attributes: Map<string, string> = new Map();

  constructor(public nodeName: string) {}

  insert(index: number, child: IModelChild): void {
    if (index !== 0) {
      throw new Error("not implemented");
    }
    this.#firstChild = child;
  }

  setAttribute(name: string, value: string) {
    // if (bannedAttributesName.has(name)) {
    //   throw new Error(`'${name}' is preserved`);
    // }
    this.#attributes.set(name, value);
  }

  getAttribute(name: string): string | undefined {
    return this.#attributes.get(name);
  }

}
