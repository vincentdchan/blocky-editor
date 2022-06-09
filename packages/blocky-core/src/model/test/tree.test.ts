// import { Action } from "space/transactions";
import { test, expect } from "vitest";
import { type TreeNode, createNode, appendChild, insertAfter, removeNode } from "../tree";

test("tree append", () => {
  const parent: TreeNode<number> = createNode(0);

  const child1 = createNode(1);
  const child2 = createNode(2);
  
  appendChild(parent, child1);
  appendChild(parent, child2);

  expect(parent.childrenLength).toBe(2);
  expect(parent.firstChild).toBe(child1);
  expect(parent.lastChild).toBe(child2);

  expect(child1.prev).toBeUndefined();
  expect(child1.next).toBe(child2);

  expect(child2.next).toBeUndefined();
  expect(child2.prev).toBe(child1);

  expect(child1.parent).toBe(parent)
  expect(child2.parent).toBe(parent)
});

test("tree insert", () => {
  const parent: TreeNode<number> = createNode(0);

  const child1 = createNode(1);
  const child2 = createNode(2);
  
  appendChild(parent, child1);
  appendChild(parent, child2);

  const child3 = createNode(3);

  insertAfter(parent, child3, child1);

  expect(child3.parent).toBe(parent);
  expect(child3.prev).toBe(child1);
  expect(child3.next).toBe(child2);

  expect(child1.next).toBe(child3);
  expect(child2.prev).toBe(child3);

  expect(parent.firstChild).toBe(child1);
  expect(parent.lastChild).toBe(child2);
  expect(parent.childrenLength).toBe(3);
});

test("tree remove", () => {
  const parent: TreeNode<number> = createNode(0);

  const child1 = createNode(1);
  const child2 = createNode(2);
  const child3 = createNode(3);
  
  appendChild(parent, child1);
  appendChild(parent, child2);
  appendChild(parent, child3);

  removeNode(child2);

  expect(child1.next).toBe(child3);
  expect(child3.prev).toBe(child1);
  expect(parent.childrenLength).toBe(2);
});

// test("diffFragments", () => {
//   const lines1: Line[] = [
//     makeLine("line-1"),
//   ];
//   const lines2: Line[] = [
//     makeLine("line-1", [
//       makeFragment("f1", "a"),
//     ]),
//   ];
//   const actions: Action[] = [];
//   diffLines(lines1, lines2, actions);
//   console.log(actions);
// });
