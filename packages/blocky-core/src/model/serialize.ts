import { BlockElement } from "@pkg/block/basic";
import State from "./state";
import { BlockyElement, BlockyTextModel } from "./tree";
import type { AttributesObject, BlockyNode } from "@pkg/model/element";

export interface JSONDocument {
  type: "document";
  blocks?: JSONBlock[];
}

export interface JSONBlock {
  type: "block";
  blockName: string;
  children?: JSONNode[];
}

export interface JSONStyledSpan {
  content: string;
  attributes: AttributesObject;
}

export type JSONTextSpan = string | JSONStyledSpan

export interface JSONText {
  type: "text";
  content: JSONTextSpan[];
}

export type JSONNode = JSONText | JSONBlock

export function serializeState(state: State): JSONDocument {
  const result: JSONDocument = {
    type: "document",
  };

  let ptr = state.root.firstChild;

  // empty
  if (!ptr) {
    return result;
  }

  const children: JSONBlock[] = [];

  while (ptr) {
    if (ptr instanceof BlockElement) {
      children.push(serializeBlock(ptr));
    }
    ptr = ptr.nextSibling;
  }
  
  result.blocks = children;
  return result;
}

function serializeBlock(blockElement: BlockElement): JSONBlock {
  const { blockName } = blockElement;
  const result: JSONBlock = {
    type: "block",
    blockName,
  };

  let childPtr = blockElement.firstChild;

  if (!childPtr) {
    return result;
  }

  const children: JSONNode[] = [];

  while (childPtr) {
    // children.push(serializeNode(childPtr));
    childPtr = childPtr.nextSibling;
  }

  result.children = children;
  return result;
}

function serializeNode(blockyNode: BlockyNode): JSONNode {
  if (blockyNode instanceof BlockyElement) {
    return {
      type: "block",
      blockName: "unknown",
    };
  } else if (blockyNode instanceof BlockyTextModel) {
    return {
      type: "text",
      content: []
    };
  } else {
    throw new Error("unexpected blocky node");
  }
}
