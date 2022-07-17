import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { expect, test } from "vitest";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { MarkupGenerator } from "@pkg/model/markup";
import { State } from "@pkg/model/state";
import { JSONNode } from "../element";

function makeDefaultUtils() {
  const blockRegistry = new BlockRegistry();
  const idGenerator = makeDefaultIdGenerator();
  const m = new MarkupGenerator(idGenerator);
  return { blockRegistry, m, idGenerator };
}

function removeId(node: JSONNode) {
  if (node.id) {
    delete node.id;
  }

  if (node.children) {
    node.children.map(removeId);
  }
}

test("tree validator", () => {
  const { blockRegistry, m, idGenerator } = makeDefaultUtils();
  State.fromMarkup(
    m.doc([m.textBlock("Hello World")]),
    blockRegistry,
    idGenerator
  );
});

test("serialize", () => {
  const { blockRegistry, m, idGenerator } = makeDefaultUtils();
  const state = State.fromMarkup(
    m.doc([m.textBlock("Hello World")]),
    blockRegistry,
    idGenerator
  );
  const json = state.toJSON();
  removeId(json);
  expect(json).toEqual({
    nodeName: "document",
    children: [
      {
        nodeName: "Text",
        children: [
          {
            nodeName: "#text",
            textContent: [
              {
                insert: "Hello World",
              },
            ],
          },
        ],
      },
    ],
  });
});
