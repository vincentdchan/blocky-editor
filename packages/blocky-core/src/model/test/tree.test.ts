import { test, expect, describe } from "vitest";
import { BlockyElement } from "@pkg/model/tree";

test("tree append", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");

  parent.appendChild(firstChild);

  let callbackIsCalled = false;
  parent.changed.on((e) => {
    if (e.type === "element-insert-child") {
      callbackIsCalled = true;
      expect(e.index).toEqual(1);
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
  parent.changed.on((e) => {
    if (e.type === "element-insert-child") {
      callbackIsCalled = true;
      expect(e.index).toEqual(0);
    }
  });

  parent.insertAfter(secondChild);

  expect(callbackIsCalled).toBeTruthy();
});

test("tree set attribute", () => {
  const node = new BlockyElement("block");

  let callbackIsCalled = false;
  node.changed.on((e) => {
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

test("tree delete children at index", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");
  const thirdChild = new BlockyElement("third-child");

  parent.appendChild(firstChild);
  parent.appendChild(secondChild);
  parent.appendChild(thirdChild);

  parent.deleteChildrenAt(1, 1);
  expect(parent.childrenLength).toBe(2);
  expect(firstChild.nextSibling).toBe(thirdChild);
  expect(thirdChild.prevSibling).toBe(firstChild);

  expect(secondChild.prevSibling).toBeNull();
  expect(secondChild.nextSibling).toBeNull();
});

test("child validation", () => {
  const element = new BlockyElement("name");
  expect(() => {
    element.appendChild(element);
  }).toThrowError("Can not add ancesters of a node as child");
  const firstChild = new BlockyElement("child");
  element.appendChild(firstChild);
  expect(() => {
    element.insertAfter(element, firstChild);
  }).toThrowError("Can not add ancesters of a node as child");
});

describe("toJSON()", () => {
  test("basic", () => {
    const element = new BlockyElement("node");
    const json = element.toJSON();
    expect(json).toEqual({ nodeName: "node" });
  });

  test("attribute", () => {
    const element = new BlockyElement("node");
    element.setAttribute("id", "123");
    const json = element.toJSON();
    expect(json).toEqual({
      id: "123",
      nodeName: "node",
    });
  });
  test("preserved attributes", () => {
    const element = new BlockyElement("node");
    expect(() => {
      element.setAttribute("children", "123");
    }).toThrow("'children' is preserved");
    expect(() => {
      element.setAttribute("nodeName", "123");
    }).toThrow("'nodeName' is preserved");
  });
});
