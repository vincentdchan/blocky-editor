import * as DocNode from "./nodes";
import type { IdGenerator } from "@pkg/helper/idHelper";
import { TextModel } from "@pkg/model/textModel";

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
  id: string;
  data?: any;
  flags: number;
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

  block(blockType: number): MBlock {
    return {
      t: "block",
      flags: blockType,
      id: this.idGen.mkBlockId(),
    };
  }

  textBlock(content: MSpan[] = []): MBlock {
    const textModel = new TextModel();

    let ptr = 0;
    for (const span of content) {
      textModel.insert(ptr, span.content);
      ptr += span.content.length;
    }

    return {
      t: "block",
      id: this.idGen.mkBlockId(),
      flags: 0,
      data: textModel,
    };
  }

  span(content: string, flags: number = 0): MSpan {
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

export function toNodeDoc(doc: MDoc): DocNode.Document {
  return {
    t: "doc",
    id: doc.id,
  };
}
