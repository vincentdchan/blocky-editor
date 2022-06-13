import type { TreeNode } from "@pkg/model/tree";
import type { Span } from "@pkg/model/nodes";

export interface SpanCreatedEvent {
  element: HTMLSpanElement;
  node: TreeNode<Span>;
}

export enum SpanType {

  /**
   * Will be rendered as a text node
   */
  PlainText = 0,

  /**
   * Will be rendered as as `<span>`,
   * multiple styles will be added to the text.
   */
  StyledText = 1,

  /**
   * Will be rendered as as `<a>`,
   * multiple styles will be added to the text.
   */
  Anchor = 2,
}

const TextSpanName = "text";

export interface SpanDefinition {
  name: string;

  type: SpanType;

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

  #types: SpanDefinition[];
  #nameMap: Map<string, number> = new Map();

  constructor() {
    this.#types = [{
      name: TextSpanName,
      type: SpanType.PlainText,
    }];
    this.#nameMap.set(TextSpanName, 0);
  }

  register(spanType: SpanDefinition): number {
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

  getSpanTypeById(id: number): SpanDefinition | undefined {
    return this.#types[id];
  }

}
