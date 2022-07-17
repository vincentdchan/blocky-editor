import { test, expect } from "vitest";
import { FixedSizeStack, StackItem } from "../undoManager";

test("stack push() and pop()", () => {
  const fixedSizeStack = new FixedSizeStack(100);
  expect(fixedSizeStack.length).toBe(0);
  const first = new StackItem();
  fixedSizeStack.push(first);
  expect(fixedSizeStack.length).toBe(1);
  const poped = fixedSizeStack.pop();
  expect(poped).toBe(first);
  expect(fixedSizeStack.pop()).toBeUndefined();
});

test("maxSize of stack", () => {
  const fixedSizeStack = new FixedSizeStack(2);
  const first = new StackItem();
  fixedSizeStack.push(first);
  expect(fixedSizeStack.length).toBe(1);
  const second = new StackItem();
  fixedSizeStack.push(second);
  expect(fixedSizeStack.length).toBe(2);
  const third = new StackItem();
  fixedSizeStack.push(third);
  expect(fixedSizeStack.length).toBe(2);
  expect(fixedSizeStack.peek()).toBe(third);
});
