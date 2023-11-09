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
  DataElement,
} from "./tree";
import Delta from "quill-delta-es";

export function blockyNodeFromJsonNode(jsonNode: JSONNode): DataBaseNode {
  const { t: nodeName } = jsonNode;
  if (nodeName === "document") {
    return documentFromJsonNode(jsonNode);
  }

  if (isUpperCase(nodeName[0])) {
    return blockElementFromJsonNode(jsonNode);
  }
  return blockyElementFromJsonNode(jsonNode);
}

export function documentFromJsonNode(jsonNode: JSONNode): BlockyDocument {
  const titleNode = jsonNode.title;
  const bodyNode = jsonNode.body;
  if (titleNode && titleNode.t !== "title") {
    throw new Error("invalid document title");
  }
  if (bodyNode?.t !== "body") {
    throw new Error("invalid document body:\n" + JSON.stringify(bodyNode));
  }
  let title: BlockDataElement | undefined;
  if (titleNode) {
    title = blockyElementFromJsonNode(titleNode) as BlockDataElement;
  }
  const body = blockyElementFromJsonNode(bodyNode);
  return new BlockyDocument({ title, body });
}

export function blockElementFromJsonNode(jsonNode: JSONNode): BlockDataElement {
  const { t: nodeName, id, children, ...jsonAttribs } = jsonNode;
  if (isUndefined(id)) {
    throw new TypeError("id is missing for jsonNode");
  }
  const attributes = getAttributesByMeta(jsonAttribs);
  const childrenNode = children?.map((child) => {
    return blockyNodeFromJsonNode(child);
  });
  return new BlockDataElement(nodeName, id, attributes, childrenNode);
}

export function blockyElementFromJsonNode(jsonNode: JSONNode): DataBaseElement {
  const { t: nodeName, children, ...jsonAttribs } = jsonNode;
  const attributes = getAttributesByMeta(jsonAttribs);
  const childrenNode: DataBaseNode[] =
    children?.map((child) => {
      return blockyNodeFromJsonNode(child);
    }) ?? [];

  return new DataElement(nodeName, attributes, childrenNode);
}

function getAttributesByMeta(attribs: any): AttributesObject | undefined {
  if (isUndefined(attribs)) {
    return undefined;
  }
  const attributes = Object.create(null);
  for (const key in attribs) {
    const value = attribs[key];
    if (isUndefined(value) || value === null) {
      continue;
    }
    if (typeof value === "object" && value.t === "rich-text") {
      attributes[key] = new BlockyTextModel(new Delta(value.ops));
    } else {
      attributes[key] = value;
    }
  }
  return attributes;
}
