import { isUndefined, isArray } from "lodash-es";
import { isUpperCase } from "blocky-common/es/character";
import Delta from "quill-delta-es";
import {
  type BlockyNode,
  type JSONNode,
  BlockElement,
  BlockyElement,
  BlockyTextModel,
  BlockyDocument,
} from "@pkg/model";

export function blockyNodeFromJsonNode(jsonNode: JSONNode): BlockyNode {
  const { nodeName } = jsonNode;
  if (nodeName === "#text") {
    return textNodeFromJsonNode(jsonNode);
  }
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

export function textNodeFromJsonNode(jsonNode: JSONNode): BlockyTextModel {
  const { textContent } = jsonNode;
  if (!isArray(textContent)) {
    return new BlockyTextModel();
  }
  const delta = new Delta(textContent);
  return new BlockyTextModel(delta);
}

export function blockElementFromJsonNode(jsonNode: JSONNode): BlockElement {
  const { nodeName, id, children, ...rest } = jsonNode;
  if (isUndefined(id)) {
    throw new TypeError("id is missing for jsonNode");
  }
  const attributes = Object.create(null);
  for (const key in rest) {
    const value = (rest as any)[key];
    if (value) {
      attributes[key] = value;
    }
  }
  const childrenNode = children?.map((child) => {
    return blockyNodeFromJsonNode(child);
  });
  return new BlockElement(nodeName, id, attributes, childrenNode);
}

export function blockyElementFromJsonNode(jsonNode: JSONNode): BlockyElement {
  const { nodeName, children, ...rest } = jsonNode;
  const attributes = Object.create(null);
  for (const key in rest) {
    const value = (rest as any)[key];
    if (value) {
      attributes[key] = value;
    }
  }
  const childrenNode: BlockyNode[] =
    children?.map((child) => {
      return blockyNodeFromJsonNode(child);
    }) ?? [];

  return new BlockyElement(nodeName, attributes, childrenNode);
}
