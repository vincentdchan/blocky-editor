// import { Action } from "space/transactions";
import { test, expect } from "vitest";
import { BlockyElement } from "../tree";

test("tree append", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");

  parent.appendChild(firstChild);

  let callbackIsCalled = false;
  parent.onChanged.on(e => {
    if (e.type === "element-insert-child") {
      callbackIsCalled = true;
      expect(e.getInsertIndex()).toEqual(1);
    }
  });

  parent.appendChild(secondChild);

  expect(callbackIsCalled).toBeTruthy();
});

test("tree insert at first", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");

  parent.appendChild(firstChild);

  let callbackIsCalled = false;
  parent.onChanged.on(e => {
    if (e.type === "element-insert-child") {
      callbackIsCalled = true;
      expect(e.getInsertIndex()).toEqual(0);
    }
  });

  parent.insertAfter(secondChild);

  expect(callbackIsCalled).toBeTruthy();
});

test("tree set attribute", () => {
  const node = new BlockyElement("block");

  let callbackIsCalled = false;
  node.onChanged.on(e => {
    if (e.type === "element-set-attrib") {
      callbackIsCalled = true;
      expect(e.key).toEqual("key");
      expect(e.value).toEqual("value");
    }
  });

  node.setAttribute("key", "value");

  expect(callbackIsCalled).toBeTruthy();
});

test("tree insert at index", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");
  const thirdChild = new BlockyElement("third-child");

  parent.appendChild(firstChild);
  parent.appendChild(thirdChild);

  parent.insertChildAt(1, secondChild);

  expect(secondChild.prevSibling).toBe(firstChild);
  expect(secondChild.nextSibling).toBe(thirdChild);
});
