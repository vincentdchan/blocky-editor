import { test, expect, describe } from "vitest";
import "@pkg/index";
import { FixedSizeStack, StackItem } from "../undoManager";

describe("FixedSizeStack", () => {
  test("push() + pop()", () => {
    const fixedSizeStack = new FixedSizeStack(100);
    expect(fixedSizeStack.length).toBe(0);
    const first = new StackItem();
    fixedSizeStack.push(first);
    expect(fixedSizeStack.length).toBe(1);
    const poped = fixedSizeStack.pop();
    expect(poped).toBe(first);
    expect(fixedSizeStack.pop()).toBeUndefined();
  });

  test("maxSize", () => {
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
    expect(first.prevSibling).toBeNull();
    expect(first.nextSibling).toBeNull();
  });

  test("clear()", () => {
    const fixedSizeStack = new FixedSizeStack(10);
    fixedSizeStack.push(new StackItem());
    fixedSizeStack.push(new StackItem());
    expect(fixedSizeStack.length).toBe(2);
    fixedSizeStack.clear();
    expect(fixedSizeStack.length).toBe(0);
  });
});
