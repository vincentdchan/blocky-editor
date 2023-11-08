import { expect, test } from "vitest";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import {
  BlockDataElement,
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

  if (node.title) {
    removeId(node.title);
  }
  if (node.body) {
    removeId(node.body);
  }
}

test("serialize", () => {
  const idGenerator = makeDefaultIdGenerator();
  const doc = new BlockyDocument({
    bodyChildren: [
      new BlockDataElement("Text", idGenerator.mkBlockId(), {
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
    t: "document",
    body: {
      t: "body",
      children: [
        {
          t: "Text",
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
  });

  test("serialize with title", () => {
    const idGenerator = makeDefaultIdGenerator();
    const doc = new BlockyDocument({
      title: "",
      bodyChildren: [
        new BlockDataElement("Text", idGenerator.mkBlockId(), {
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
      t: "document",
      title: {
        t: "Title",
        attributes: {
          textContent: [],
        },
        "#meta": {
          textContent: "rich-text",
        },
      },
      body: {
        t: "body",
        children: [
          {
            t: "Text",
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
    });
  });
});
