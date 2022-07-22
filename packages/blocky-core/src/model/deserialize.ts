import { isUndefined, isArray } from "lodash-es";
import { isUpperCase } from "blocky-common/es/character";
import Delta from "quill-delta-es";
import { BlockElement } from "@pkg/block/basic";
import {
  type BlockyNode,
  type JSONNode,
  BlockyElement,
  BlockyTextModel,
} from "@pkg/model/tree";

export function blockyNodeFromJsonNode(jsonNode: JSONNode): BlockyNode {
  const { nodeName, children, ...rest } = jsonNode;
  if (nodeName === "#text") {
    return textNodeFromJsonNode(jsonNode);
  }
  if (isUpperCase(nodeName[0])) {
    return blockElementFromJsonNode(jsonNode);
  }
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
