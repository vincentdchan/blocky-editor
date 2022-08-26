import { test, expect } from "vitest";
import { hashIntArrays } from "../hash";

test("hashIntArrays", () => {
  expect(hashIntArrays([])).toBe(0);
  expect(hashIntArrays([1])).toBe(hashIntArrays([1]));
  expect(hashIntArrays([1])).not.toBe(hashIntArrays([1, 1]));
  expect(hashIntArrays([1])).not.toBe(hashIntArrays([2]));
});
