import { isUndefined } from "lodash-es";
import { isUpperCase } from "blocky-common/es/character";
import type {
  BlockElement,
  IBlockDefinition,
  TryParsePastedDOMEvent,
} from "@pkg/block/basic";
import { makeTextBlockDefinition, TextBlockName } from "@pkg/block/textBlock";

export class BlockRegistry {
  #types: IBlockDefinition[];
  #nameMap: Map<string, number> = new Map();

  constructor() {
    this.#types = [makeTextBlockDefinition()];
    this.#nameMap.set(TextBlockName, 0);
  }

  register(blockType: IBlockDefinition): number {
    const { name } = blockType;
    if (this.#nameMap.has(name)) {
      throw new Error(`SpanType '${name}' exists`);
    }

    if (!isUpperCase(name[0])) {
      throw new Error("The first char of the block name must be uppercase.");
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
    if (isUndefined(id)) {
      return;
    }
    return this.#types[id];
  }

  getBlockIdByName(name: string): number | undefined {
    return this.#nameMap.get(name);
  }

  handlePasteElement(e: TryParsePastedDOMEvent): BlockElement | void {
    for (const def of this.#types) {
      const test = def.tryParsePastedDOM?.(e);
      if (test) {
        return test;
      }
    }
  }
}
