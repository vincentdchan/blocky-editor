import { test, expect, describe } from "vitest";
import { BlockyElement } from "..";

test("tree append", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");

  parent.__insertChildAt(parent.childrenLength, firstChild);

  let callbackIsCalled = false;
  parent.changed.on((e) => {
    if (e.type === "element-insert-child") {
      callbackIsCalled = true;
      expect(e.index).toEqual(1);
    }
  });

  parent.__insertChildAt(parent.childrenLength, secondChild);

  expect(callbackIsCalled).toBeTruthy();
});

test("tree insert at first", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");

  parent.__insertChildAt(parent.childrenLength, firstChild);

  let callbackIsCalled = false;
  parent.changed.on((e) => {
    if (e.type === "element-insert-child") {
      callbackIsCalled = true;
      expect(e.index).toEqual(0);
    }
  });

  parent.__insertChildAt(3, secondChild);

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

  node.__setAttribute("key", "value");

  expect(callbackIsCalled).toBeTruthy();
});

test("tree insert at index", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");
  const thirdChild = new BlockyElement("third-child");

  parent.__insertChildAt(parent.childrenLength, firstChild);
  parent.__insertChildAt(parent.childrenLength, thirdChild);

  parent.__insertChildAt(1, secondChild);

  expect(secondChild.prevSibling).toBe(firstChild);
  expect(secondChild.nextSibling).toBe(thirdChild);
});

test("tree delete children at index", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");
  const thirdChild = new BlockyElement("third-child");

  parent.__insertChildAt(parent.childrenLength, firstChild);
  parent.__insertChildAt(parent.childrenLength, secondChild);
  parent.__insertChildAt(parent.childrenLength, thirdChild);

  parent.__deleteChildrenAt(1, 1);
  expect(parent.childrenLength).toBe(2);
  expect(firstChild.nextSibling).toBe(thirdChild);
  expect(thirdChild.prevSibling).toBe(firstChild);

  expect(secondChild.prevSibling).toBeNull();
  expect(secondChild.nextSibling).toBeNull();
});

test("child validation", () => {
  const element = new BlockyElement("name");
  expect(() => {
    element.__insertChildAt(element.childrenLength, element);
  }).toThrowError("Can not add ancestors of a node as child");
  const firstChild = new BlockyElement("child");
  element.__insertChildAt(element.childrenLength, firstChild);
  expect(() => {
    element.__insertChildAt(1, element);
  }).toThrowError("Can not add ancestors of a node as child");
});

describe("toJSON()", () => {
  test("basic", () => {
    const element = new BlockyElement("node");
    const json = element.toJSON();
    expect(json).toEqual({ nodeName: "node" });
  });

  test("attribute", () => {
    const element = new BlockyElement("node");
    element.__setAttribute("name", "123");
    const json = element.toJSON();
    console.log("json", json);
    expect(json).toEqual({
      nodeName: "node",
      attributes: {
        name: "123",
      },
    });
  });
  test("preserved attributes", () => {
    const element = new BlockyElement("node");
    expect(() => {
      element.__setAttribute("children", "123");
    }).toThrow("'children' is preserved");
    expect(() => {
      element.__setAttribute("nodeName", "123");
    }).toThrow("'nodeName' is preserved");
  });
});
