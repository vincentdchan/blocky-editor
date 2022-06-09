import type { TreeNode } from "model/tree";
import type { Span } from "model/nodes";

export interface SpanCreatedEvent {
  element: HTMLSpanElement;
  node: TreeNode<Span>;
}

const TextSpanName = "text";

export interface ISpanType {
  name: string;

  /**
   * The class will be added to the <span> element
   */
  classNames?: string[];

  /**
   * Will be triggered when the real HTMLSpanElement is created
   */
  onSpanCreated?: (e: SpanCreatedEvent) => void;
}

// 0 for normal item
export class SpanRegistry {

  #types: ISpanType[];
  #nameMap: Map<string, number> = new Map();

  constructor() {
    this.#types = [{
      name: TextSpanName,
    }];
    this.#nameMap.set(TextSpanName, 0);
  }

  register(spanType: ISpanType): number {
    const { name } = spanType;
    if (this.#nameMap.has(name)) {
      throw new Error(`SpanType '${name}' exists`);
    }

    const id = this.#types.length;
    this.#nameMap.set(name, id);
    this.#types.push(spanType);
    return id;
  }

  getSpanIdByName(name: string): number | undefined {
    return this.#nameMap.get(name);
  }

  getSpanTypeById(id: number): ISpanType | undefined {
    return this.#types[id];
  }

}
