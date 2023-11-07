import { isUndefined } from "lodash-es";
import { isUpperCase } from "blocky-common/es";
import {
  type DataBaseNode,
  type JSONNode,
  BlockDataElement,
  DataBaseElement,
  BlockyDocument,
  AttributesObject,
  BlockyTextModel,
  metaKey,
} from "./tree";
import Delta from "quill-delta-es";

export function blockyNodeFromJsonNode(jsonNode: JSONNode): DataBaseNode {
  const { nodeName } = jsonNode;
  if (nodeName === "document") {
    return documentFromJsonNode(jsonNode);
  }

  if (isUpperCase(nodeName[0])) {
    return blockElementFromJsonNode(jsonNode);
  }
  return blockyElementFromJsonNode(jsonNode);
}

export function documentFromJsonNode(jsonNode: JSONNode): BlockyDocument {
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

export function blockElementFromJsonNode(jsonNode: JSONNode): BlockDataElement {
  const { nodeName, id, children, attributes: jsonAttribs } = jsonNode;
  if (isUndefined(id)) {
    throw new TypeError("id is missing for jsonNode");
  }
  const attributes = getAttributesByMeta(jsonAttribs, jsonNode);
  const childrenNode = children?.map((child) => {
    return blockyNodeFromJsonNode(child);
  });
  return new BlockDataElement(nodeName, id, attributes, childrenNode);
}

export function blockyElementFromJsonNode(jsonNode: JSONNode): DataBaseElement {
  const { nodeName, children, attributes: jsonAttribs } = jsonNode;
  const attributes = getAttributesByMeta(jsonAttribs, jsonNode);
  const childrenNode: DataBaseNode[] =
    children?.map((child) => {
      return blockyNodeFromJsonNode(child);
    }) ?? [];

  return new DataBaseElement(nodeName, attributes, childrenNode);
}

function getAttributesByMeta(
  attribs: any,
  jsonNode: JSONNode
): AttributesObject | undefined {
  if (isUndefined(attribs)) {
    return undefined;
  }
  const attributes = Object.create(null);
  const meta = jsonNode[metaKey];
  for (const key in attribs) {
    const value = attribs[key];
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
