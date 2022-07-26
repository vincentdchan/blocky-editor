import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { test, expect } from "vitest";
import { Changeset } from "../change";
import { State } from "../state";
import { BlockyDocument, BlockyElement } from "../tree";

test("test delete", () => {
  const i1 = new BlockyElement("item");
  const i2 = new BlockyElement("item");
  const i3 = new BlockyElement("item");
  const document = new BlockyDocument({
    bodyChildren: [new BlockyElement("item"), i1, i2, i3],
  });
  const blockRegistry = new BlockRegistry();
  const idGenerator = makeDefaultIdGenerator();
  const state = new State(document, blockRegistry, idGenerator);
  const change = new Changeset(state);
  change.removeChild(document.body, i1);
  change.removeChild(document.body, i2);
  change.removeChild(document.body, i3);
  const finalizedChangeset = change.finalize();
  expect(finalizedChangeset.operations.length).toBe(3);
  expect(finalizedChangeset.operations[0].location.last).toBe(1);
  expect(finalizedChangeset.operations[1].location.last).toBe(1);
  expect(finalizedChangeset.operations[2].location.last).toBe(1);
});
