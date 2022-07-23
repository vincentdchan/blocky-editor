import { test, expect } from "vitest";
import "@pkg/index";
import { BlockElement, symInsertChildAt } from "@pkg/model/tree";
import { TextBlockName } from "@pkg/block/textBlock";
import { DocNodeName, BlockyElement } from "@pkg/model";

test("block level 0", () => {
  const root = new BlockyElement(DocNodeName);
  const firstElement = new BlockElement(TextBlockName, "id-1");
  root[symInsertChildAt](root.childrenLength, firstElement);
  expect(firstElement.blockLevel()).toBe(0);
});

test("block level 1", () => {
  const root = new BlockyElement(DocNodeName);
  const firstElement = new BlockElement(TextBlockName, "id-1");
  root[symInsertChildAt](root.childrenLength, firstElement);
  const childElement = new BlockElement(TextBlockName, "id-2");
  firstElement[symInsertChildAt](firstElement.childrenLength, childElement);
  expect(childElement.blockLevel()).toBe(1);
});
