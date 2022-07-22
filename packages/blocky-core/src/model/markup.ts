import { isObject } from "lodash-es";
import type { IdGenerator } from "@pkg/helper/idHelper";
import type { AttributesObject, JSONNode, JSONChild } from "@pkg/model/tree";

export class MarkupGenerator {
  constructor(private idGen: IdGenerator) {}

  elem(
    nodeName: string,
    attributes: AttributesObject,
    children?: AttributesObject
  ) {
    return {
      nodeName,
      attributes,
      children,
    };
  }

  doc(children: JSONNode[]): JSONNode {
    return {
      nodeName: "document",
      id: this.idGen.mkDocId(),
      children,
    };
  }

  block(blockName: string): JSONNode {
    return {
      nodeName: blockName,
      id: this.idGen.mkBlockId(),
    };
  }

  text(content: string): JSONNode {
    return {
      nodeName: "#text",
      textContent: [
        {
          insert: content,
        },
      ],
    };
  }

  textBlock(content: string, id?: string): JSONNode {
    return {
      nodeName: "Text",
      id: id ?? this.idGen.mkBlockId(),
      children: [this.text(content)],
    };
  }
}

export type Traversor<R> = (
  node: JSONChild,
  parent?: JSONNode,
  parentResult?: R
) => R;

export function traverse<R>(
  node: JSONChild,
  traversor: Traversor<R>,
  parent?: JSONNode,
  parentResult?: R
): R {
  const result = traversor(node, parent, parentResult);

  if (isObject(node)) {
    node.children?.forEach((child) => traverse(child, traversor, node, result));
  }

  return result;
}

// export function toNodeDoc(doc: MDoc): TreeRoot {
//   return {
//     id: doc.id,
//     blockTypeId: -1,
//     childrenLength: 0,
//   };
// }
