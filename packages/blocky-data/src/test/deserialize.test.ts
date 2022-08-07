import { expect, test } from "vitest";
import "@pkg/index";
import Delta from "quill-delta-es";
import {
  BlockElement,
  BlockyDocument,
  BlockyElement,
  BlockyTextModel,
  blockyNodeFromJsonNode,
} from "..";

test("deserialize BlockElement", () => {
  const blockElement = new BlockElement("Text", "Blk-text-1");
  const json = blockElement.toJSON();
  const back = blockyNodeFromJsonNode(json) as BlockElement;
  expect(back instanceof BlockElement).toBeTruthy();
  expect(back.nodeName).toBe("Text");
  expect(back.id).toBe("Blk-text-1");
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
  const blockElement = new BlockElement("Text", "Blk-text-1");
  const document = new BlockyDocument({
    bodyChildren: [blockElement],
  });
  const json = document.toJSON();
  const back = blockyNodeFromJsonNode(json);
  expect(back.nodeName).toBe("document");
  expect(back instanceof BlockyDocument).toBeTruthy();
});
