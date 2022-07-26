import { isUndefined } from "lodash-es";
import { isUpperCase } from "blocky-common/es/character";
import { BlockyTextModel, metaKey } from "@pkg/model/tree";
import {
  type BlockyNode,
  type JSONNode,
  BlockElement,
  BlockyElement,
  BlockyDocument,
} from "@pkg/model";
import Delta from "quill-delta-es";

export function blockyNodeFromJsonNode(jsonNode: JSONNode): BlockyNode {
  const { nodeName } = jsonNode;
  if (nodeName === "document") {
    return documentFromJsonNode(jsonNode);
  }

  if (isUpperCase(nodeName[0])) {
    return blockElementFromJsonNode(jsonNode);
  }
  return blockyElementFromJsonNode(jsonNode);
}

export function documentFromJsonNode(jsonNode: JSONNode): BlockyElement {
  const headNode = jsonNode.children![0];
  const bodyNode = jsonNode.children![1];
  if (headNode.nodeName !== "head") {
    throw new Error("invalid document head");
  }
  if (bodyNode.nodeName !== "body") {
    throw new Error("invalid document body");
  }
  const head = blockyElementFromJsonNode(headNode);
  const body = blockyElementFromJsonNode(bodyNode);
  return new BlockyDocument({ head, body });
}

export function blockElementFromJsonNode(jsonNode: JSONNode): BlockElement {
  const { nodeName, id, children, ...rest } = jsonNode;
  if (isUndefined(id)) {
    throw new TypeError("id is missing for jsonNode");
  }
  const attributes = getAttributesByMeta(rest);
  const childrenNode = children?.map((child) => {
    return blockyNodeFromJsonNode(child);
  });
  return new BlockElement(nodeName, id, attributes, childrenNode);
}

export function blockyElementFromJsonNode(jsonNode: JSONNode): BlockyElement {
  const { nodeName, children, ...rest } = jsonNode;
  const attributes = getAttributesByMeta(rest);
  const childrenNode: BlockyNode[] =
    children?.map((child) => {
      return blockyNodeFromJsonNode(child);
    }) ?? [];

  return new BlockyElement(nodeName, attributes, childrenNode);
}

function getAttributesByMeta(rest: any): any {
  const attributes = Object.create(null);
  const meta = rest[metaKey];
  for (const key in rest) {
    const value = (rest as any)[key];
    if (isUndefined(value) || value === null) {
      continue;
    }
    if (meta && meta[key] === "rich-text") {
      attributes[key] = new BlockyTextModel(new Delta(value));
    } else {
      attributes[key] = value;
    }
  }
  return attributes;
}
