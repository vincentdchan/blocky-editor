import {
  type AttributesObject,
  type DataBaseNode,
  BlockDataElement,
  BlockyTextModel,
} from "@pkg/data";
import { makeDefaultIdGenerator } from "./idHelper";
import Delta from "quill-delta-es";

export const bky = {
  idGenerator: makeDefaultIdGenerator(),
  text(
    attributes?: AttributesObject | Delta,
    children?: DataBaseNode[]
  ): BlockDataElement {
    const newId = this.idGenerator.mkBlockId();
    if (attributes instanceof Delta) {
      return new BlockDataElement("Text", newId, {
        textContent: new BlockyTextModel(attributes),
      });
    }
    return new BlockDataElement("Text", newId, attributes, children);
  },
  element(
    text: string,
    attributes?: AttributesObject,
    children?: DataBaseNode[]
  ) {
    const newId = this.idGenerator.mkBlockId();
    return new BlockDataElement(text, newId, attributes, children);
  },
};
