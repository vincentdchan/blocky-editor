import { type IBlockDefinition, BlockContentType } from "@pkg/block/basic";
import { makeTextBlockDefinition, TextBlockName } from "@pkg/block/textBlock";

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

  getBlockDefByName(name: string): IBlockDefinition | undefined {
    const id = this.#nameMap.get(name);
    if (typeof id === "undefined") {
      return;
    }
    return this.#types[id];
  }

  getBlockIdByName(name: string): number | undefined {
    return this.#nameMap.get(name);
  }

}
