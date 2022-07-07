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
    children.push(serializeNode(ptr));
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
      const attributes = blockyNode.getAttributes();
      for (const key in attributes) {
        if (key === "nodeName") {
          continue;
        }
        if (key === "blockName") {
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

      let childPtr = blockyNode?.firstChild;
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

  } else if (blockyNode instanceof BlockyTextModel) {
    const textContent = serializeTextModel(blockyNode);
    return {
      nodeName: "#text",
      textContent,
    }
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
    const delta: TextDelta = {
      insert: ptr.content,
    };
    if (ptr.attributes) {
      delta.attributes = ptr.attributes;
    }
    result.push({
      insert: ptr.content,
    });
    ptr = ptr.next;
  }

  return result;
}
