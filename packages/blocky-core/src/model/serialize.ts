import { BlockElement } from "@pkg/block/basic";
import State from "./state";
import { BlockyElement, BlockyTextModel } from "./tree";
import type { AttributesObject, BlockyNode } from "@pkg/model/element";

export interface TextDelta {
  retain?: number;
  insert?: string;
  attributes?: any;
  delete?: number;
}

export interface JSONNode {
  nodeName: string;
  id?: string;
  textContent?: TextDelta[];
  blockName?: string;
  attributes?: AttributesObject;
  children?: JSONChild[];
}

export type JSONChild = JSONNode;

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
      children.push(serializeNode(ptr));
    }
    ptr = ptr.nextSibling;
  }

  result.children = children;
  return result;
}

function serializeNode(blockyNode: BlockyNode): JSONChild {
  if (blockyNode instanceof BlockyElement) {
    const result: JSONNode = {
      nodeName: blockyNode.nodeName,
    };

    if (blockyNode instanceof BlockElement) {
      const { childrenContainer } = blockyNode;
      result.blockName = blockyNode.blockName;

      const attributes = blockyNode.getAttributes();
      for (const key in attributes) {
        if (key === "nodeName") {
          continue;
        }
        if (key === "type") {
          continue;
        }
        if (key === "id") {
          continue;
        }
        const value = attributes[key];
        if (value) {
          (result as any)[key] = value;
        }
      }
      // if (Object.keys(attributes).length > 0) {
      //   result.attributes = blockyNode.getAttributes();
      // }

      if (blockyNode.firstChild && blockyNode.firstChild instanceof BlockyTextModel) {
        result.textContent = serializeTextModel(blockyNode.firstChild);
      }

      let childPtr = childrenContainer?.firstChild;
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
    }

    return result;
  } else {
    throw new Error("unexpected blocky node");
  }
}

function serializeTextModel(textModel: BlockyTextModel): TextDelta[] {
  const result: TextDelta[] = []
  let ptr = textModel.nodeBegin;
  if (!ptr) {
    return result;
  }

  while (ptr) {
    result.push({
      insert: ptr.content,
      attributes: ptr.attributes,
    });
    ptr = ptr.next;
  }

  return result;
}
