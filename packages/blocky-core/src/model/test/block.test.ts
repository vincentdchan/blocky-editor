import { test, expect } from "vitest";
import "@pkg/index";
import {
  BlockyDocument,
  BlockElement,
  symInsertChildAt,
} from "@pkg/model/tree";
import { TextBlockName } from "@pkg/block/textBlock";

test("block level 0", () => {
  const root = new BlockyDocument();
  const firstElement = new BlockElement(TextBlockName, "id-1");
  root[symInsertChildAt](root.childrenLength, firstElement);
  expect(firstElement.blockLevel()).toBe(0);
});

test("block level 1", () => {
  const root = new BlockyDocument();
  const firstElement = new BlockElement(TextBlockName, "id-1");
  root[symInsertChildAt](root.childrenLength, firstElement);
  const childElement = new BlockElement(TextBlockName, "id-2");
  firstElement[symInsertChildAt](firstElement.childrenLength, childElement);
  expect(childElement.blockLevel()).toBe(1);
});
