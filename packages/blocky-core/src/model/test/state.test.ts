import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { test } from "vitest";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { MarkupGenerator } from "@pkg/model/markup";
import State from "@pkg/model/state";

function makeDefaultUtils() {
  const blockRegistry = new BlockRegistry;
  const idGenerator = makeDefaultIdGenerator();
  const m = new MarkupGenerator(idGenerator);
  return { blockRegistry, m, idGenerator };
}

test("tree validator", () => {
  const { blockRegistry, m, idGenerator } = makeDefaultUtils();
  State.fromMarkup(
    m.doc([m.textBlock([m.span("Hello World")])]),
    blockRegistry,
    idGenerator,
  );
});

// test("tree validate root", () => {
//   const { blockRegistry, idGenerator } = makeDefaultUtils();
//   const node: TreeNode<DocNode> =  createNode({
//     t: "span",
//     id: idGenerator.mkSpanId(),
//     flags: 0,
//     content: ""
//   });
//   expect(() => {
//     new State(node, blockRegistry);
//   }).toThrowError(ValidateError);
// });

test("serialize", () => {
  const { blockRegistry, m, idGenerator } = makeDefaultUtils();
  const state = State.fromMarkup(
    m.doc([m.textBlock([m.span("Hello World")])]),
    blockRegistry,
    idGenerator,
  );
  // console.log(serializeJSON(state));
});
