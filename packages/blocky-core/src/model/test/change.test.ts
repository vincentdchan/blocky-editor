import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { test, expect, describe } from "vitest";
import { Changeset } from "../change";
import { State } from "../state";
import { NodeLocation } from "../location";
import { transformOperation } from "../operations";
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
  const state = new State("User-1", document, blockRegistry, idGenerator);
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

describe("transform path", () => {
  test("path transform changed", () => {
    expect(
      NodeLocation.transform(new NodeLocation([0, 1]), new NodeLocation([0, 1]))
        .path
    ).toEqual([0, 2]);
    expect(
      NodeLocation.transform(new NodeLocation([0, 1]), new NodeLocation([0, 2]))
        .path
    ).toEqual([0, 3]);
    expect(
      NodeLocation.transform(
        new NodeLocation([0, 1]),
        new NodeLocation([0, 2, 7, 8, 9])
      ).path
    ).toEqual([0, 3, 7, 8, 9]);
    expect(
      NodeLocation.transform(
        new NodeLocation([0, 1, 2]),
        new NodeLocation([0, 0, 7, 8, 9])
      ).path
    ).toEqual([0, 0, 7, 8, 9]);
  });
  test("path transform not changed", () => {
    expect(
      NodeLocation.transform(
        new NodeLocation([0, 1, 2]),
        new NodeLocation([0, 0, 7, 8, 9])
      ).path
    ).toEqual([0, 0, 7, 8, 9]);
    expect(
      NodeLocation.transform(
        new NodeLocation([0, 1, 2]),
        new NodeLocation([0, 1])
      ).path
    ).toEqual([0, 1]);
    expect(
      NodeLocation.transform(new NodeLocation([1, 1]), new NodeLocation([1, 0]))
        .path
    ).toEqual([1, 0]);
  });
  test("path transform delta", () => {
    expect(
      NodeLocation.transform(
        new NodeLocation([0, 1]),
        new NodeLocation([0, 1]),
        5
      ).path
    ).toEqual([0, 6]);
  });
});

describe("transform operation", () => {
  test("insert + insert", () => {
    const t = transformOperation(
      {
        type: "op-insert-node",
        location: new NodeLocation([0, 1]),
        children: [new BlockyElement("node"), new BlockyElement("node")],
      },
      {
        type: "op-insert-node",
        location: new NodeLocation([0, 1]),
        children: [new BlockyElement("node")],
      }
    );
    expect(t.location.path).toEqual([0, 3]);
  });
  test("delete + delete", () => {
    const t = transformOperation(
      {
        type: "op-remove-node",
        location: new NodeLocation([0, 1]),
        children: [new BlockyElement("node"), new BlockyElement("node")],
      },
      {
        type: "op-remove-node",
        location: new NodeLocation([0, 3]),
        children: [new BlockyElement("node")],
      }
    );
    expect(t.location.path).toEqual([0, 1]);
  });
});
