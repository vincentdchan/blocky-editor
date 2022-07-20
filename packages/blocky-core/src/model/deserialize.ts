import { isUndefined, isArray } from "lodash-es";
import { isUpperCase } from "blocky-common/es/character";
import Delta from "quill-delta-es";
import type { BlockyNode, JSONNode } from "@pkg/model/element";
import { BlockElement } from "@pkg/block/basic";
import { BlockyElement, BlockyTextModel } from "./tree";

export function blockyNodeFromJsonNode(jsonNode: JSONNode): BlockyNode {
  const { nodeName, children, ...rest } = jsonNode;
  if (nodeName === "#text") {
    return textNodeFromJsonNode(jsonNode);
  }
  if (isUpperCase(nodeName[0])) {
    return blockElementFromJsonNode(jsonNode);
  }
  const result = new BlockyElement(nodeName);
  for (const key in rest) {
    const value = (rest as any)[key];
    if (value) {
      result.setAttribute(key, value);
    }
  }
  children?.forEach((child) => {
    result.appendChild(blockyNodeFromJsonNode(child));
  });
  return result;
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
  const result = new BlockElement(nodeName, id);
  for (const key in rest) {
    const value = (rest as any)[key];
    if (value) {
      result.setAttribute(key, value);
    }
  }
  children?.forEach((child) => {
    result.appendChild(blockyNodeFromJsonNode(child));
  });
  return result;
}
