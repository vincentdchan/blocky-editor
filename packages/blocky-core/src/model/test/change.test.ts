import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { test, expect, describe } from "vitest";
import { Changeset } from "../change";
import { State } from "../state";
import { NodeLocation } from "../location";
import { type TextEditOperation, transformOperation } from "../operations";
import {
  BlockElement,
  BlockyDocument,
  BlockyElement,
  BlockyTextModel,
} from "../tree";
import Delta from "quill-delta-es";

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
  test("edit + edit", () => {
    const base = new Delta([{ insert: "Hello World" }]);
    const delta = new Delta().retain(6).insert(" ooo ");
    const invert = delta.invert(base);
    expect(invert.ops).toEqual([{ retain: 6 }, { delete: 5 }]);
    const delta2 = new Delta().insert("Title: ");
    const invert2 = delta2.invert(new Delta());
    const t = transformOperation(
      {
        type: "op-text-edit",
        location: new NodeLocation([1, 0]),
        id: "title",
        key: "textContent",
        delta: delta2,
        invert: invert2,
      },
      {
        type: "op-text-edit",
        location: new NodeLocation([1, 0]),
        id: "title",
        key: "textContent",
        delta,
        invert,
      }
    ) as TextEditOperation;
    expect(t.type).toBe("op-text-edit");
    expect(t.delta.ops).toEqual([{ retain: 13 }, { insert: " ooo " }]);
    expect(t.invert.ops).toEqual([{ retain: 13 }, { delete: 5 }]);
  });
});

describe("merge", () => {
  test("pushWillMerge", () => {
    const idGenerator = makeDefaultIdGenerator();
    const textBlock = new BlockElement("Text", idGenerator.mkBlockId(), {
      textContent: new BlockyTextModel(),
    });
    const document = new BlockyDocument({
      bodyChildren: [textBlock],
    });
    const blockRegistry = new BlockRegistry();
    const state = new State("User-1", document, blockRegistry, idGenerator);
    const change = new Changeset(state);
    change.textEdit(textBlock, "textContent", () => new Delta().insert("a"));
    change.textEdit(textBlock, "textContent", () => new Delta().insert("b"));
    const finalizedChangeset = change.finalize();
    expect(finalizedChangeset.operations.length).toBe(1);
    const first = finalizedChangeset.operations[0] as TextEditOperation;
    expect(first.type).toBe("op-text-edit");
    expect(first.delta.ops).toEqual([{ insert: "ba" }]);
  });
  test("testWillNotMerge", () => {
    const idGenerator = makeDefaultIdGenerator();
    const textBlock1 = new BlockElement("Text", idGenerator.mkBlockId(), {
      textContent: new BlockyTextModel(),
    });
    const textBlock2 = new BlockElement("Text", idGenerator.mkBlockId(), {
      textContent: new BlockyTextModel(),
    });
    const document = new BlockyDocument({
      bodyChildren: [textBlock1, textBlock2],
    });
    const blockRegistry = new BlockRegistry();
    const state = new State("User-1", document, blockRegistry, idGenerator);
    const change = new Changeset(state);
    change.deleteChildrenAt(document, 0, 1);
    change.textEdit(textBlock2, "textContent", () => new Delta().insert("a"));
    const finalizedChangeset = change.finalize();
    expect(finalizedChangeset.operations.length).toBe(2);
  });
});
