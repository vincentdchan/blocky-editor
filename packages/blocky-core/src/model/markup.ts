import * as DocNode from "./nodes";
import type { IdGenerator } from "helper/idHelper";

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
  content: MSpan[];
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

  line(content: MSpan[] = []): MBlock {
    return {
      t: "block",
      id: this.idGen.mkBlockId(),
      content,
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
      for (const childNode of node.content) {
        traverse(childNode, traversor, node, result);
      }
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

export function toNodeBlock(line: MBlock): DocNode.Block {
  return {
    t: "block",
    id: line.id,
    flags: 0,
  };
}

export function toNodeSpan(span: MSpan): DocNode.Span {
  const { id, flags, content } = span;
  return { t: "span", id, flags, content };
}
