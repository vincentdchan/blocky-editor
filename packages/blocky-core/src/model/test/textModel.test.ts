import { TextModel } from "@pkg/model/textModel";
import { test, expect } from "vitest";

test("textModel", () => {
  const text = new TextModel();
  text.insert(0, "Hello world");
  expect(text.length).toBe("Hello world".length);
});
