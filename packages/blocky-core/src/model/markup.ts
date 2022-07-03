import type { IdGenerator } from "@pkg/helper/idHelper";
import { type AttributesObject, type BlockyNode } from "./element";
import { BlockyTextModel } from "./tree";

/*
 * Large document tree
 */
export interface MDoc {
  t: "doc";
  id: string;
  content: MBlock[];
}

export interface MBlock {
  t: "block";
  blockName: string;
  id: string,
  attributes?: AttributesObject;
  data?: BlockyNode,
  children?: MBlock[];
}

export interface MSpan {
  t: "span";
  id: string;
  content: string;
  flags: number;
}

export type MNode = MDoc | MBlock | MSpan;

export class MarkupGenerator {

  constructor(private idGen: IdGenerator) {}

  doc(content: MBlock[]): MDoc {
    return {
      t: "doc",
      id: this.idGen.mkDocId(),
      content,
    };
  }

  block(blockName: string): MBlock {
    return {
      t: "block",
      blockName,
      id: this.idGen.mkBlockId(),
    };
  }

  textBlock(content: MSpan[] = [], id?: string): MBlock {
    const textModel = new BlockyTextModel;

    let ptr = 0;
    for (const span of content) {
      textModel.insert(ptr, span.content);
      ptr += span.content.length;
    }

    return {
      t: "block",
      id: id ?? this.idGen.mkBlockId(),
      blockName: "text",
      data: textModel,
    };
  }

  span(content: string, flags = 0): MSpan {
    return {
      t: "span",
      id: this.idGen.mkSpanId(),
      content,
      flags,
    };
  }

}


export type Traversor<R> = (node: MNode, parent?: MNode, parentResult?: R) => R;

export function traverse<R>(
  node: MNode,
  traversor: Traversor<R>,
  parent?: MNode,
  parentResult?: R,
): R {
  const result = traversor(node, parent, parentResult);
  switch (node.t) {
    case "doc": {
      for (const childNode of node.content) {
        traverse(childNode, traversor, node, result);
      }
      break;
    }

    case "block": {
      if (node.children) {
        for (const childNode of node.children) {
          traverse(childNode, traversor, node, result);
        }
      }
      break;
    }

    default: {
    }
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
