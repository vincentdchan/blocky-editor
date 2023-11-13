import { isUndefined } from "lodash-es";
import { isUpperCase } from "blocky-common/es";
import type {
  IBlockDefinition,
  TryParsePastedDOMEvent,
} from "@pkg/block/basic";
import type { BlockDataElement } from "@pkg/data";
import { Registry } from "./registry";
import { TextBlock } from "@pkg/block/textBlock";
import { TitleBlock } from "@pkg/block/titleBlock";

export class BlockRegistry extends Registry<IBlockDefinition> {
  #types: IBlockDefinition[];
  #nameMap: Map<string, number> = new Map();

  constructor() {
    super();
    this.#types = [TextBlock, TitleBlock];
    this.#nameMap.set(TextBlock.Name, 0);
    this.#nameMap.set(TitleBlock.Name, 1);
  }

  register(blockType: IBlockDefinition): number {
    this.ensureUnsealed();
    const { Name: name } = blockType;
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

  handlePasteElement(e: TryParsePastedDOMEvent): BlockDataElement | void {
    for (const def of this.#types) {
      const test = def.TryParsePastedDOM?.(e);
      if (test) {
        return test;
      }
    }
  }
}
