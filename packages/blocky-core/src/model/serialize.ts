import { BlockElement } from "@pkg/block/basic";
import State from "./state";
import { BlockyElement, BlockyTextModel, TextNode } from "./tree";
import type { AttributesObject, BlockyNode } from "@pkg/model/element";

export interface JSONNode {
  nodeName: string;
  id?: string;
  textContent?: string;
  blockName?: string;
  attributes?: AttributesObject;
  children?: JSONChild[];
}

export type JSONChild = JSONNode | string;

export function serializeState(state: State): JSONNode {
  const result: JSONNode = {
    nodeName: "document",
  };

  let ptr = state.root.firstChild;

  // empty
  if (!ptr) {
    return result;
  }

  const children: JSONNode[] = [];

  while (ptr) {
    if (ptr instanceof BlockElement) {
      children.push(serializeBlock(ptr));
    }
    ptr = ptr.nextSibling;
  }

  result.children = children;
  return result;
}

function serializeBlock(blockElement: BlockElement): JSONNode {
  const { blockName } = blockElement;
  const result: JSONNode = {
    nodeName: "block",
    blockName,
  };

  let childPtr = blockElement.firstChild;

  if (!childPtr) {
    return result;
  }

  const children: JSONChild[] = [];

  while (childPtr) {
    const child = serializeNode(childPtr);
    if (Array.isArray(child)) {
      children.push(...child);
    } else {
      children.push(child);
    }
    childPtr = childPtr.nextSibling;
  }

  result.children = children;
  return result;
}

function serializeNode(blockyNode: BlockyNode): JSONChild | JSONChild[] {
  if (blockyNode instanceof BlockyElement) {
    const result: JSONNode = {
      nodeName: blockyNode.nodeName,
    };

    if (blockyNode instanceof BlockElement) {
      result.nodeName = blockyNode.blockName;
    }

    const attributes = blockyNode.getAttributes();
    if (Object.keys(attributes).length > 0) {
      result.attributes = blockyNode.getAttributes();
    }

    let childPtr = blockyNode.firstChild;
    if (childPtr) {
      const children: JSONChild[] = [];

      while (childPtr) {
        const child = serializeNode(childPtr);
        if (Array.isArray(child)) {
          children.push(...child);
        } else {
          children.push(child);
        }
        childPtr = childPtr.nextSibling;
      }

      result.children = children;
    }

    return result;
  } else if (blockyNode instanceof BlockyTextModel) {
    return serializeTextModel(blockyNode as BlockyTextModel);
  } else {
    throw new Error("unexpected blocky node");
  }
}

function serializeTextModel(textModel: BlockyTextModel): JSONChild | JSONChild[] {
  let ptr = textModel.nodeBegin;
  if (!ptr) {
    return [];
  }

  if (!ptr.next) {
    return textNodeToChildNode(ptr);
  }

  const children: JSONChild[] = [];

  while (ptr) {
    children.push(textNodeToChildNode(ptr));
    ptr = ptr.next;
  }

  return children;
}

function textNodeToChildNode(textNode: TextNode): JSONChild {
  const { attributes } = textNode;
  if (!attributes || Object.keys(attributes).length === 0) {
    return textNode.content;
  }
  return {
    nodeName: "#text",
    textContent: textNode.content,
    attributes,
  };
}
