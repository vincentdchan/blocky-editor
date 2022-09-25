import {
  BlockElement,
  BlockyDocument,
  BlockyTextModel,
  Delta,
} from "blocky-data";
import { expect, test } from "vitest";
import { SearchContext } from "../searchContext";

test("search empty", () => {
  const doc = new BlockyDocument();
  const dummyEditorContainer = document.createElement("div");
  const searchContent = new SearchContext(dummyEditorContainer, doc);
  searchContent.search("Hello");
  expect(searchContent.contexts.length).toBe(0);
});

test("search text", () => {
  const doc = new BlockyDocument({
    bodyChildren: [
      new BlockElement("Text", "id-1", {
        textContent: new BlockyTextModel(new Delta().insert("Hello World")),
      }),
      new BlockElement("Text", "id-2", {
        textContent: new BlockyTextModel(new Delta().insert("World Hello")),
      }),
      new BlockElement("Text", "id-3", {
        textContent: new BlockyTextModel(
          new Delta().insert("World").insert({}).insert(" Hello")
        ),
      }),
    ],
  });
  const dummyEditorContainer = document.createElement("div");
  const searchContent = new SearchContext(dummyEditorContainer, doc);
  searchContent.search("Hello");
  expect(searchContent.contexts.length).toBe(3);
  expect(searchContent.contexts[0]).toEqual({
    blockId: "id-1",
    startIndex: 0,
  });
  expect(searchContent.contexts[1]).toEqual({
    blockId: "id-2",
    startIndex: 6,
  });
  expect(searchContent.contexts[2]).toEqual({
    blockId: "id-3",
    startIndex: 7,
  });
});
