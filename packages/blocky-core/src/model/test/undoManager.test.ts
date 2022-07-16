import { test, expect } from "vitest";
import { UndoManager, createStackItem } from "../undoManager";

test("undoManager", () => {
  const undoManager = new UndoManager();
  expect(undoManager.length).toBe(0);
  const first = createStackItem();
  undoManager.push(first);
  expect(undoManager.length).toBe(1);
  const poped = undoManager.pop();
  expect(poped).toBe(first);
  expect(undoManager.pop()).toBeUndefined();
});
