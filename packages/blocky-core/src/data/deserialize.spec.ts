import { expect, test } from "vitest";
import "@pkg/index";
import Delta from "quill-delta-es";
import {
  BlockDataElement,
  BlockyDocument,
  DataBaseElement,
  BlockyTextModel,
  blockyNodeFromJsonNode,
} from "./index";
import { bky } from "../helper/bky";

test("deserialize BlockElement", () => {
  const blockElement = bky.text();
  const id = blockElement.id;
  const json = blockElement.toJSON();
  const back = blockyNodeFromJsonNode(json) as BlockDataElement;
  expect(back instanceof BlockDataElement).toBeTruthy();
  expect(back.t).toBe("Text");
  expect(back.id).toBe(id);
});

test("deserialize BlockyTextModel", () => {
  const delta = new Delta().insert("Hello World");
  const textModel = new BlockyTextModel(delta);
  const textElement = new DataBaseElement("text", {
    textContent: textModel,
  });
  const json = textElement.toJSON();
  const back = blockyNodeFromJsonNode(json) as DataBaseElement;
  expect(
    back.getAttribute<BlockyTextModel>("textContent") instanceof BlockyTextModel
  ).toBeTruthy();
});

test("deserialize document", () => {
  const blockElement = bky.text();
  const document = new BlockyDocument({
    bodyChildren: [blockElement],
  });
  const json = document.toJSON();
  const back = blockyNodeFromJsonNode(json);
  expect(back.t).toBe("document");
  expect(back instanceof BlockyDocument).toBeTruthy();
  const json2 = back.toJSON();
  expect(json2).toEqual(json);
});
