import type { State } from "./state";
import type { AttributesObject, BlockyNode } from "@pkg/model/element";
import {
  type BlockyElement,
  symSetAttribute,
  symAppendChild,
  symRemoveChild,
  symInsertChildAt,
} from "./tree";

export class Changeset {
  constructor(readonly state: State) {}
  setAttribute(node: BlockyElement, attributes: AttributesObject): Changeset {
    for (const key in attributes) {
      const value = attributes[key];
      node[symSetAttribute](key, value);
    }
    return this;
  }
  appendChild(node: BlockyElement, child: BlockyNode): Changeset {
    node[symAppendChild](child);
    return this;
  }
  removeNode(parent: BlockyElement, child: BlockyNode): Changeset {
    parent[symRemoveChild](child);
    return this;
  }
  insertChildAt(
    parent: BlockyElement,
    index: number,
    node: BlockyNode
  ): Changeset {
    parent[symInsertChildAt](index, node);
    return this;
  }
  apply() {}
}
