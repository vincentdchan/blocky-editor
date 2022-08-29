import { test, expect } from "vitest";
import { removeLineBreaks } from "../text";

test("removeLineBreaks", () => {
  expect(removeLineBreaks("\n")).toBe("");
  expect(removeLineBreaks(null)).toBe("");
  expect(removeLineBreaks("Hello World\n")).toBe("Hello World");
  expect(removeLineBreaks("Hello World\r\n")).toBe("Hello World");
});
