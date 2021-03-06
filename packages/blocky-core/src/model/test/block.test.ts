import { test, expect } from "vitest";
import "@pkg/index";
import { BlockElement } from "@pkg/block/basic";
import { symInsertChildAt } from "@pkg/model/tree";
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
  const deepElement = new BlockElement(TextBlockName, "id-2");
  const childrenContainer = new BlockyElement("block-children");
  firstElement[symInsertChildAt](
    firstElement.childrenLength,
    childrenContainer
  );
  childrenContainer[symInsertChildAt](
    childrenContainer.childrenLength,
    deepElement
  );
  expect(deepElement.blockLevel()).toBe(1);
});
