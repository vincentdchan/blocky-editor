import type { State } from "./state";
import type { AttributesObject, BlockyNode } from "@pkg/model/element";
import type { Operation } from "./operations";
import Delta from "quill-delta-es";
import {
  type BlockyElement,
  type BlockyTextModel,
  symSetAttribute,
  symAppendChild,
  symRemoveChild,
  symInsertAfter,
  symInsertChildAt,
  symTextEdit,
  symTextConcat,
  symDeleteChildrenAt,
} from "./tree";

export class Changeset {
  readonly operations: Operation[] = [];
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
  symDeleteChildrenAt(
    parent: BlockyElement,
    index: number,
    count: number
  ): Changeset {
    parent[symDeleteChildrenAt](index, count);
    return this;
  }
  insertChildAfter(
    parent: BlockyElement,
    child: BlockyNode,
    after?: BlockyNode
  ): Changeset {
    parent[symInsertAfter](child, after);
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
  textEdit(textNode: BlockyTextModel, delta: () => Delta): Changeset {
    const d = delta();
    textNode[symTextEdit](d);
    return this;
  }
  textConcat(textNode: BlockyTextModel, delta: () => Delta): Changeset {
    const d = delta();
    textNode[symTextConcat](d);
    return this;
  }
  apply() {}
}
