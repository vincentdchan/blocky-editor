import {
  BlockElement,
  BlockyDocument,
  BlockyTextModel,
  Delta,
} from "blocky-data";
import { Editor } from "../../view/editor";
import { EditorController } from "../../view/controller";
import { expect, test } from "vitest";
import { SearchContext } from "../searchContext";

test("search empty", () => {
  const dummyEditorContainer = document.createElement("div");
  const controller = new EditorController("dummyId");
  const editor = Editor.fromController(dummyEditorContainer, controller);
  const searchContent = new SearchContext(dummyEditorContainer, editor);
  searchContent.search("Hello");
  expect(searchContent.contexts.length).toBe(0);
});

test("search text multiple lines", () => {
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
  const controller = new EditorController("dummyId", {
    document: doc,
  });
  const editor = Editor.fromController(dummyEditorContainer, controller);
  const searchContent = new SearchContext(dummyEditorContainer, editor);
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

test("search text multiple times in one line", () => {
  const doc = new BlockyDocument({
    bodyChildren: [
      new BlockElement("Text", "id-1", {
        textContent: new BlockyTextModel(
          new Delta().insert("Hello world! Hello world")
        ),
      }),
    ],
  });
  const dummyEditorContainer = document.createElement("div");
  const controller = new EditorController("dummyId", {
    document: doc,
  });
  const editor = Editor.fromController(dummyEditorContainer, controller);
  const searchContent = new SearchContext(dummyEditorContainer, editor);
  searchContent.search("Hello");
  expect(searchContent.contexts.length).toBe(2);
  expect(searchContent.contexts[0]).toEqual({
    blockId: "id-1",
    startIndex: 0,
  });
  expect(searchContent.contexts[1]).toEqual({
    blockId: "id-1",
    startIndex: 13,
  });
});
