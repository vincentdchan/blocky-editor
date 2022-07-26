import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { expect, test, describe } from "vitest";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { MarkupGenerator } from "@pkg/model/markup";
import { State, NodeLocation } from "@pkg/model/state";
import type { JSONNode } from "../tree";

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
        nodeName: "head",
      },
      {
        nodeName: "body",
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
      },
    ],
  });
});

describe("NodeLocation", () => {
  test("hashCode", () => {
    const l1 = new NodeLocation([]);
    expect(l1.hashCode).toBe(0);
    const l2 = new NodeLocation([1, 2, 3]);
    const l3 = new NodeLocation([1, 2, 3]);
    expect(l2.hashCode).toEqual(l3.hashCode);
    const l4 = new NodeLocation([0, 2, 3]);
    expect(l2.hashCode).not.equal(l4.hashCode);
    const l5 = new NodeLocation([1, 2, 3, 4]);
    expect(l2.hashCode).not.equal(l5.hashCode);
  });
});
