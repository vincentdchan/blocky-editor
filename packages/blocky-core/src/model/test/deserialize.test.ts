import { expect, test } from "vitest";
import "@pkg/index";
import Delta from "quill-delta-es";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import {
  BlockElement,
  BlockyDocument,
  BlockyElement,
  BlockyTextModel,
  blockyNodeFromJsonNode,
} from "blocky-data";

const idGenerator = makeDefaultIdGenerator();

test("deserialize BlockElement", () => {
  const id = idGenerator.mkBlockId();
  const blockElement = new BlockElement("Text", id);
  const json = blockElement.toJSON();
  const back = blockyNodeFromJsonNode(json) as BlockElement;
  expect(back instanceof BlockElement).toBeTruthy();
  expect(back.nodeName).toBe("Text");
  expect(back.id).toBe(id);
});

test("deserialize BlockyTextModel", () => {
  const delta = new Delta().insert("Hello World");
  const textModel = new BlockyTextModel(delta);
  const textElement = new BlockyElement("text", {
    textContent: textModel,
  });
  const json = textElement.toJSON();
  const back = blockyNodeFromJsonNode(json) as BlockyElement;
  expect(
    back.getAttribute<BlockyTextModel>("textContent") instanceof BlockyTextModel
  ).toBeTruthy();
});

test("deserialize document", () => {
  const id = idGenerator.mkBlockId();
  const blockElement = new BlockElement("Text", id);
  const document = new BlockyDocument({
    bodyChildren: [blockElement],
  });
  const json = document.toJSON();
  const back = blockyNodeFromJsonNode(json);
  expect(back.nodeName).toBe("document");
  expect(back instanceof BlockyDocument).toBeTruthy();
});
