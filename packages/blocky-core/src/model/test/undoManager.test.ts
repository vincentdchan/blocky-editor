import { test, expect } from "vitest";
import { FixedSizeStack, createStackItem } from "../undoManager";

test("FixedSizeStack", () => {
  const fixedSizeStack = new FixedSizeStack();
  expect(fixedSizeStack.length).toBe(0);
  const first = createStackItem();
  fixedSizeStack.push(first);
  expect(fixedSizeStack.length).toBe(1);
  const poped = fixedSizeStack.pop();
  expect(poped).toBe(first);
  expect(fixedSizeStack.pop()).toBeUndefined();
});
