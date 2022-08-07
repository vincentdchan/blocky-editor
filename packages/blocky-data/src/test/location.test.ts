import { expect, test, describe } from "vitest";
import { NodeLocation } from "..";

describe("NodeLocation", () => {
  test("hashCode", () => {
    const l1 = new NodeLocation([]);
    expect(l1.hashCode).toBe(0);
    const l2 = new NodeLocation([1, 2, 3]);
    const l3 = new NodeLocation([1, 2, 3]);
    expect(l2.hashCode).toEqual(l3.hashCode);
    const l4 = new NodeLocation([0, 2, 3]);
    expect(l2.hashCode).not.equal(l4.hashCode);
    const l5 = new NodeLocation([1, 2, 3, 4]);
    expect(l2.hashCode).not.equal(l5.hashCode);
  });
});
