import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { expect, test } from "vitest";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { MarkupGenerator } from "@pkg/model/markup";
import { serializeState } from "@pkg/model/serialize";
import State from "@pkg/model/state";

function makeDefaultUtils() {
  const blockRegistry = new BlockRegistry();
  const idGenerator = makeDefaultIdGenerator();
  const m = new MarkupGenerator(idGenerator);
  return { blockRegistry, m, idGenerator };
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
  const json = serializeState(state);
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
