import { expect, test } from "vitest";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { bky } from "@pkg/helper/bky";
import {
  BlockDataElement,
  BlockyDocument,
  BlockyTextModel,
  JSONNode,
} from "@pkg/data";
import Delta from "quill-delta-es";
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
    bodyChildren: [bky.text(new Delta([{ insert: "Hello world" }]))],
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
          textContent: {
            t: "rich-text",
            ops: [
              {
                insert: "Hello world",
              },
            ],
          },
        },
      ],
    },
  });

  test("serialize with title", () => {
    const idGenerator = makeDefaultIdGenerator();
    const doc = new BlockyDocument({
      title: "",
      bodyChildren: [bky.text(new Delta([{ insert: "Hello world" }]))],
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
        textContent: { t: "rich-text", ops: [] },
      },
      body: {
        t: "body",
        children: [
          {
            t: "Text",
            textContent: {
              t: "rich-text",
              ops: [
                {
                  insert: "Hello world",
                },
              ],
            },
          },
        ],
      },
    });
  });
});
