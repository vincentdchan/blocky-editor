import { test, expect } from "vitest";
import "@pkg/index";
import { BlockyDocument, BlockDataElement } from "@pkg/data";
import { bky } from "@pkg/helper/bky";

test("block level 0", () => {
  const root = new BlockyDocument();
  const firstElement = bky.text();
  root.__insertChildAt(root.childrenLength, firstElement);
  expect(firstElement.blockLevel()).toBe(0);
});

test("block level 1", () => {
  const root = new BlockyDocument();
  const firstElement = bky.text();
  root.__insertChildAt(root.childrenLength, firstElement);
  const childElement = bky.text();
  firstElement.__insertChildAt(firstElement.childrenLength, childElement);
  expect(childElement.blockLevel()).toBe(1);
});
