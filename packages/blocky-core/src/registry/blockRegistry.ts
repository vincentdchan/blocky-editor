import { elem } from "common/dom";
import type { TreeNode } from "model/tree";
import type { DocNode } from "model/nodes";

export enum BlockContentType {
  Text,
  Custom,
}

export interface SpanCreatedEvent {
  element: HTMLElement;
  node: TreeNode<DocNode>;
}

export interface IBlockDefinition {
  name: string;
  type: BlockContentType;

  /**
   * if a block's type is [[Text]],
   * this method must be provided.
   * 
   * A text block must have a child element to contain
   * the text content.
   */
  findContentContainer?: (parent: HTMLElement) => HTMLElement;

  onContainerCreated?: (e: SpanCreatedEvent) => void;
}

const TextBlockName = "text-block";

function makeTextBlockDefinition(): IBlockDefinition {
  return {
    name: TextBlockName,
    type: BlockContentType.Text,
    findContentContainer(parent: HTMLElement) {
      return parent.firstChild! as HTMLElement;
    },
    onContainerCreated({ element }) {
      const content = elem("div", "mg-line-content");
      element.appendChild(content);
    },
  };
}

export class BlockRegistry {
  #types: IBlockDefinition[];
  #nameMap: Map<string, number> = new Map();

  constructor() {
    this.#types = [makeTextBlockDefinition()];
    this.#nameMap.set(TextBlockName, 0);
  }

  register(blockType: IBlockDefinition): number {
    const { name, type, findContentContainer } = blockType;
    if (this.#nameMap.has(name)) {
      throw new Error(`SpanType '${name}' exists`);
    }

    if (type === BlockContentType.Text && typeof findContentContainer === "undefined") {
      throw new Error(`missing method of plugin '${name}': findContentContainer`);
    }

    const id = this.#types.length;
    this.#nameMap.set(name, id);
    this.#types.push(blockType);
    return id;
  }

  getBlockDefById(id: number): IBlockDefinition | undefined {
    return this.#types[id];
  }

}
