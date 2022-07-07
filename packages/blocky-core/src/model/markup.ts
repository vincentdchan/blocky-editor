import type { IdGenerator } from "@pkg/helper/idHelper";
import type { AttributesObject } from "./element";
import * as S from "./serialize";

export class MarkupGenerator {

  constructor(private idGen: IdGenerator) {}

  elem(nodeName: string, attributes: AttributesObject, children?: AttributesObject) {
    return {
      nodeName,
      attributes,
      children,
    }
  }

  doc(children: S.JSONNode[]): S.JSONNode {
    return {
      nodeName: "document",
      id: this.idGen.mkDocId(),
      children,
    };
  }

  block(blockName: string): S.JSONNode {
    return {
      nodeName: blockName,
      id: this.idGen.mkBlockId(),
    };
  }

  text(content: string): S.JSONNode {
    return {
      nodeName: "#text",
      textContent: [{
        insert: content,
      }],
    };
  }

  textBlock(content: string, id?: string): S.JSONNode {
    return {
      nodeName: "Text",
      id: id ?? this.idGen.mkBlockId(),
      children: [
        this.text(content),
      ],
    };
  }

}

export type Traversor<R> = (node: S.JSONChild, parent?: S.JSONNode, parentResult?: R) => R;

export function traverse<R>(
  node: S.JSONChild,
  traversor: Traversor<R>,
  parent?: S.JSONNode,
  parentResult?: R,
): R {
  const result = traversor(node, parent, parentResult);

  if (typeof node === "object") {
    node.children?.forEach(child => traverse(child, traversor, node, result));
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
