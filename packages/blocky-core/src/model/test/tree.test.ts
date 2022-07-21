import { test, expect, describe } from "vitest";
import {
  BlockyElement,
  symSetAttribute,
  symInsertChildAt,
  symDeleteChildrenAt,
} from "@pkg/model/tree";

test("tree append", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");

  parent[symInsertChildAt](parent.childrenLength, firstChild);

  let callbackIsCalled = false;
  parent.changed.on((e) => {
    if (e.type === "element-insert-child") {
      callbackIsCalled = true;
      expect(e.index).toEqual(1);
    }
  });

  parent[symInsertChildAt](parent.childrenLength, secondChild);

  expect(callbackIsCalled).toBeTruthy();
});

test("tree insert at first", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");

  parent[symInsertChildAt](parent.childrenLength, firstChild);

  let callbackIsCalled = false;
  parent.changed.on((e) => {
    if (e.type === "element-insert-child") {
      callbackIsCalled = true;
      expect(e.index).toEqual(0);
    }
  });

  parent[symInsertChildAt](3, secondChild);

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

  node[symSetAttribute]("key", "value");

  expect(callbackIsCalled).toBeTruthy();
});

test("tree insert at index", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");
  const thirdChild = new BlockyElement("third-child");

  parent[symInsertChildAt](parent.childrenLength, firstChild);
  parent[symInsertChildAt](parent.childrenLength, thirdChild);

  parent[symInsertChildAt](1, secondChild);

  expect(secondChild.prevSibling).toBe(firstChild);
  expect(secondChild.nextSibling).toBe(thirdChild);
});

test("tree delete children at index", () => {
  const parent = new BlockyElement("block");
  const firstChild = new BlockyElement("first-child");
  const secondChild = new BlockyElement("second-child");
  const thirdChild = new BlockyElement("third-child");

  parent[symInsertChildAt](parent.childrenLength, firstChild);
  parent[symInsertChildAt](parent.childrenLength, secondChild);
  parent[symInsertChildAt](parent.childrenLength, thirdChild);

  parent[symDeleteChildrenAt](1, 1);
  expect(parent.childrenLength).toBe(2);
  expect(firstChild.nextSibling).toBe(thirdChild);
  expect(thirdChild.prevSibling).toBe(firstChild);

  expect(secondChild.prevSibling).toBeNull();
  expect(secondChild.nextSibling).toBeNull();
});

test("child validation", () => {
  const element = new BlockyElement("name");
  expect(() => {
    element[symInsertChildAt](element.childrenLength, element);
  }).toThrowError("Can not add ancestors of a node as child");
  const firstChild = new BlockyElement("child");
  element[symInsertChildAt](element.childrenLength, firstChild);
  expect(() => {
    element[symInsertChildAt](1, element);
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
    element[symSetAttribute]("id", "123");
    const json = element.toJSON();
    expect(json).toEqual({
      id: "123",
      nodeName: "node",
    });
  });
  test("preserved attributes", () => {
    const element = new BlockyElement("node");
    expect(() => {
      element[symSetAttribute]("children", "123");
    }).toThrow("'children' is preserved");
    expect(() => {
      element[symSetAttribute]("nodeName", "123");
    }).toThrow("'nodeName' is preserved");
  });
});
