import { test, expect } from "vitest";
import { isUpperCase } from "../character";

test("isUpperCase", () => {
  expect(isUpperCase("")).toBeFalsy();
  expect(isUpperCase("U")).toBeTruthy();
  expect(isUpperCase("Uu")).toBeTruthy();
  expect(isUpperCase("1")).toBeFalsy();
});
