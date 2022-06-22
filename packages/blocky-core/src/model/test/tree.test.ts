// import { Action } from "space/transactions";
// import { test, expect } from "vitest";
import { test } from "vitest";
// import { type TreeNode, createNode, appendChild, insertAfter, removeNode } from "../tree";
// import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";

// const i = makeDefaultIdGenerator();

test("tree append", () => {
  // const parent: TreeNode = createNode(i.mkBlockId(), 0, 0);

  // const child1 = createNode(i.mkBlockId(), 0, 1);
  // const child2 = createNode(i.mkBlockId(), 0, 2);
  
  // appendChild(parent, child1);
  // appendChild(parent, child2);

  // expect(parent.childrenLength).toBe(2);
  // expect(parent.firstChild).toBe(child1);
  // expect(parent.lastChild).toBe(child2);

  // expect(child1.prev).toBeUndefined();
  // expect(child1.next).toBe(child2);

  // expect(child2.next).toBeUndefined();
  // expect(child2.prev).toBe(child1);

  // expect(child1.parent).toBe(parent)
  // expect(child2.parent).toBe(parent)
});

test("tree insert", () => {
  // const parent: TreeNode<number> = createNode(i.mkBlockId(), 0, 0);

  // const child1 = createNode(i.mkBlockId(), 0, 1);
  // const child2 = createNode(i.mkBlockId(), 0, 2);
  
  // appendChild(parent, child1);
  // appendChild(parent, child2);

  // const child3 = createNode(i.mkBlockId(), 0, 3);

  // insertAfter(parent, child3, child1);

  // expect(child3.parent).toBe(parent);
  // expect(child3.prev).toBe(child1);
  // expect(child3.next).toBe(child2);

  // expect(child1.next).toBe(child3);
  // expect(child2.prev).toBe(child3);

  // expect(parent.firstChild).toBe(child1);
  // expect(parent.lastChild).toBe(child2);
  // expect(parent.childrenLength).toBe(3);
});

test("tree remove", () => {
  // const parent: TreeNode<number> = createNode(i.mkBlockId(), 0, 0);

  // const child1 = createNode(i.mkBlockId(), 0, 1);
  // const child2 = createNode(i.mkBlockId(), 0, 2);
  // const child3 = createNode(i.mkBlockId(), 0, 3);
  
  // appendChild(parent, child1);
  // appendChild(parent, child2);
  // appendChild(parent, child3);

  // removeNode(child2);

  // expect(child1.next).toBe(child3);
  // expect(child3.prev).toBe(child1);
  // expect(parent.childrenLength).toBe(2);
});
