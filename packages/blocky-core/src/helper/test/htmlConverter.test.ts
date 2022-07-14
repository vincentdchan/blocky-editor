import { test, expect } from "vitest";
import { HTMLConverter } from "@pkg/helper/htmlConverter";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { TextBlockName } from "@pkg/block/textBlock";

const idGenerator = makeDefaultIdGenerator();

test("test paragraph", () => {
  const parser = new HTMLConverter({ idGenerator });
  const blocks = parser.parseFromString("<p>content</p>");
  expect(blocks.length).toBe(1);
});

test("test ul list", () => {
  const parser = new HTMLConverter({ idGenerator });
  const blocks = parser.parseFromString("<ul><li>content<li></ul>");
  expect(blocks.length).toBe(1);
  expect(blocks[0].nodeName).toBe(TextBlockName);
});
