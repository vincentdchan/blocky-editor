import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { expect, test } from "vitest";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import {
  BlockElement,
  BlockyDocument,
  BlockyTextModel,
  JSONNode,
} from "blocky-data";
import { EditorState } from "../editorState";
import Delta from "quill-delta-es";

function makeDefaultUtils() {
  const blockRegistry = new BlockRegistry();
  const idGenerator = makeDefaultIdGenerator();
  return { blockRegistry, idGenerator };
}

function removeId(node: JSONNode) {
  if (node.id) {
    delete node.id;
  }

  if (node.children) {
    node.children.map(removeId);
  }
}

test("serialize", () => {
  const { blockRegistry, idGenerator } = makeDefaultUtils();
  const doc = new BlockyDocument({
    bodyChildren: [
      new BlockElement("Text", idGenerator.mkBlockId(), {
        textContent: new BlockyTextModel(
          new Delta([{ insert: "Hello world" }])
        ),
      }),
    ],
  });
  const state = new EditorState("User-1", doc, blockRegistry, idGenerator);
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
