import { expect, test } from "vitest";
import "@pkg/index";
import { BlockElement } from "@pkg/block/basic";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { BlockyTextModel } from "@pkg/model/tree";
import { blockyNodeFromJsonNode } from "../deserialize";
import Delta from "quill-delta-es";

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
  const json = textModel.toJSON();
  const back = blockyNodeFromJsonNode(json) as BlockyTextModel;
  expect(back instanceof BlockyTextModel).toBeTruthy();
  expect(back.delta.ops).toEqual(delta.ops);
});
