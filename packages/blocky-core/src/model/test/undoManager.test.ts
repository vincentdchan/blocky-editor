import { test, expect, describe, vi } from "vitest";
import { FixedSizeStack, HistoryItem, UndoManager } from "../undoManager";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { EditorState } from "../editorState";
import {
  BlockDataElement,
  BlockyDocument,
  BlockyTextModel,
  Changeset,
  ChangesetRecordOption,
  Delta,
  FinalizedChangeset,
  InsertNodeOperation,
} from "blocky-data";
import "@pkg/index";

describe("FixedSizeStack", () => {
  test("push() + pop()", () => {
    const fixedSizeStack = new FixedSizeStack(100);
    expect(fixedSizeStack.length).toBe(0);
    const first = new HistoryItem();
    fixedSizeStack.push(first);
    expect(fixedSizeStack.length).toBe(1);
    const poped = fixedSizeStack.pop();
    expect(poped).toBe(first);
    expect(fixedSizeStack.pop()).toBeUndefined();
  });

  test("maxSize", () => {
    const fixedSizeStack = new FixedSizeStack(2);
    const first = new HistoryItem();
    fixedSizeStack.push(first);
    expect(fixedSizeStack.length).toBe(1);
    const second = new HistoryItem();
    fixedSizeStack.push(second);
    expect(fixedSizeStack.length).toBe(2);
    const third = new HistoryItem();
    fixedSizeStack.push(third);
    expect(fixedSizeStack.length).toBe(2);
    expect(fixedSizeStack.peek()).toBe(third);
    expect(first.prevSibling).toBeNull();
    expect(first.nextSibling).toBeNull();
  });

  test("clear()", () => {
    const fixedSizeStack = new FixedSizeStack(10);
    fixedSizeStack.push(new HistoryItem());
    fixedSizeStack.push(new HistoryItem());
    expect(fixedSizeStack.length).toBe(2);
    fixedSizeStack.clear();
    expect(fixedSizeStack.length).toBe(0);
  });
});

describe("UndoManager", () => {
  const userId = "User-1";

  test("delete", () => {
    const idGenerator = makeDefaultIdGenerator();
    const e1 = new BlockDataElement("Text", idGenerator.mkBlockId(), {
      textContent: new BlockyTextModel(new Delta().insert("0")),
    });
    const e2 = new BlockDataElement("Text", idGenerator.mkBlockId(), {
      textContent: new BlockyTextModel(new Delta().insert("1")),
    });
    const e3 = new BlockDataElement("Text", idGenerator.mkBlockId(), {
      textContent: new BlockyTextModel(new Delta().insert("2")),
    });
    const doc = new BlockyDocument({
      bodyChildren: [e1, e2, e3],
    });
    const state = new EditorState({
      userId,
      document: doc,
      idGenerator,
    });

    new Changeset(state).removeNode(e1).removeNode(e2).removeNode(e3).apply({
      record: ChangesetRecordOption.Undo,
    });

    const undoManager = new UndoManager(state);
    const undoItem = undoManager.getAUndoItem();
    undoItem.startVersion = 1;
    undoItem.length = 1;
    undoItem.seal();

    const spy = vi.spyOn(state, "apply");

    spy.mockImplementationOnce((changeset: FinalizedChangeset) => {
      expect(changeset.operations.length).toBe(3);
      expect(changeset.operations[0].location.path).toEqual(["body", 0]);
      expect(changeset.operations[0].op).toBe("insert-nodes");
      const insert1 = (changeset.operations[0] as InsertNodeOperation)
        .children[0];
      expect(insert1.textContent).toEqual({
        t: "rich-text",
        ops: [{ insert: "2" }],
      });

      expect(changeset.operations[1].location.path).toEqual(["body", 0]);
      expect(changeset.operations[1].op).toBe("insert-nodes");
      const insert2 = (changeset.operations[1] as InsertNodeOperation)
        .children[0];
      expect(insert2.textContent).toEqual({
        t: "rich-text",
        ops: [{ insert: "1" }],
      });

      expect(changeset.operations[2].location.path).toEqual(["body", 0]);
      expect(changeset.operations[2].op).toBe("insert-nodes");
      const insert3 = (changeset.operations[2] as InsertNodeOperation)
        .children[0];
      expect(insert3.textContent).toEqual({
        t: "rich-text",
        ops: [{ insert: "0" }],
      });

      return true;
    });

    undoManager.undo();

    expect(spy).toHaveBeenCalledOnce();
  });
});
