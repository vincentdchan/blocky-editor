import { expect, test } from "vitest";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import {
  BlockElement,
  BlockyDocument,
  BlockyTextModel,
  JSONNode,
  Delta,
} from "blocky-data";
import { EditorState } from "../editorState";

function removeId(node: JSONNode) {
  if (node.id) {
    delete node.id;
  }

  if (node.children) {
    node.children.map(removeId);
  }
}

test("serialize", () => {
  const idGenerator = makeDefaultIdGenerator();
  const doc = new BlockyDocument({
    bodyChildren: [
      new BlockElement("Text", idGenerator.mkBlockId(), {
        textContent: new BlockyTextModel(
          new Delta([{ insert: "Hello world" }])
        ),
      }),
    ],
  });
  const state = new EditorState({
    userId: "User-1",
    document: doc,
    idGenerator,
  });
  const json = state.toJSON();
  removeId(json);
  expect(json).toEqual({
    nodeName: "document",
    children: [
      {
        nodeName: "head",
        children: [
          {
            nodeName: "Title",
            attributes: {
              textContent: [],
            },
            "#meta": {
              textContent: "rich-text",
            },
          },
        ],
      },
      {
        nodeName: "body",
        children: [
          {
            nodeName: "Text",
            attributes: {
              textContent: [
                {
                  insert: "Hello world",
                },
              ],
            },
            "#meta": {
              textContent: "rich-text",
            },
          },
        ],
      },
    ],
  });
});
