import { test, expect } from "vitest";
import { FixedSizeStack, StackItem } from "../undoManager";

test("FixedSizeStack", () => {
  const fixedSizeStack = new FixedSizeStack();
  expect(fixedSizeStack.length).toBe(0);
  const first = new StackItem();
  fixedSizeStack.push(first);
  expect(fixedSizeStack.length).toBe(1);
  const poped = fixedSizeStack.pop();
  expect(poped).toBe(first);
  expect(fixedSizeStack.pop()).toBeUndefined();
});
