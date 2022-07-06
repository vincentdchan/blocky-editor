import type { IdGenerator } from "@pkg/helper/idHelper";
import * as S from "./serialize";

export class MarkupGenerator {

  constructor(private idGen: IdGenerator) {}

  doc(children: S.JSONNode[]): S.JSONNode {
    return {
      nodeName: "document",
      id: this.idGen.mkDocId(),
      children,
    };
  }

  block(blockName: string): S.JSONNode {
    return {
      nodeName: "block",
      blockName,
      id: this.idGen.mkBlockId(),
    };
  }

  textBlock(content: string, id?: string): S.JSONNode {
    return {
      nodeName: "block",
      id: id ?? this.idGen.mkBlockId(),
      blockName: "text",
      textContent: [{
        insert: content,
      }],
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
