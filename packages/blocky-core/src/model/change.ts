import type { State } from "./state";
import type { AttributesObject, BlockyNode } from "@pkg/model/element";
import {
  type BlockyElement,
  symSetAttribute,
  symAppendChild,
  symRemoveChild,
  symInsertChildAt,
} from "./tree";

export class Change {
  constructor(readonly state: State) {}
  setAttribute(node: BlockyElement, attributes: AttributesObject): Change {
    for (const key in attributes) {
      const value = attributes[key];
      node[symSetAttribute](key, value);
    }
    return this;
  }
  appendChild(node: BlockyElement, child: BlockyNode): Change {
    node[symAppendChild](child);
    return this;
  }
  removeNode(parent: BlockyElement, child: BlockyNode): Change {
    parent[symRemoveChild](child);
    return this;
  }
  insertChildAt(
    parent: BlockyElement,
    index: number,
    node: BlockyNode
  ): Change {
    parent[symInsertChildAt](index, node);
    return this;
  }
  apply() {}
}
