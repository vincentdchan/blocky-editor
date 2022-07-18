import Delta from "quill-delta";
import { type WithState, WithStateSlot } from "@pkg/helper/withStateSlot";
import type {
  JSONNode,
  JSONChild,
  AttributesObject,
  BlockyNode,
} from "./element";
import type { ElementChangedEvent } from "./events";
import type { State } from "./state";

export interface TextSlice {
  content: string;
  attributes?: AttributesObject;
}

export interface DeltaChangedEvent {
  oldDelta: Delta;
  newDelta: Delta;
}

export class BlockyTextModel implements BlockyNode, WithState {
  #delta = new Delta();
  state?: State;
  parent: BlockyNode | null = null;
  nextSibling: BlockyNode | null = null;
  prevSibling: BlockyNode | null = null;
  readonly changed: WithStateSlot<DeltaChangedEvent> = new WithStateSlot(this);

  constructor(delta?: Delta) {
    this.#delta = delta ?? new Delta();
  }

  get childrenLength(): number {
    return 0;
  }

  get nodeName(): string {
    return "#text";
  }

  get delta(): Delta {
    return this.#delta;
  }

  compose(delta: Delta) {
    const oldDelta = this.#delta;
    const newDelta = this.delta.compose(delta);
    this.#delta = newDelta;
    this.changed.emit({ oldDelta, newDelta });
  }

  concat(delta: Delta) {
    const oldDelta = this.#delta;
    const newDelta = this.delta.concat(delta);
    this.#delta = newDelta;
    this.changed.emit({ oldDelta, newDelta });
  }

  toString(): string {
    return this.#delta.reduce((prev, op) => {
      if (typeof op.insert === "string") {
        return (prev += op.insert);
      }
      return prev;
    }, "");
  }

  get length() {
    return this.#delta.length();
  }

  get firstChild(): BlockyNode | null {
    return null;
  }

  get lastChild(): BlockyNode | null {
    return null;
  }

  clone(): BlockyTextModel {
    return new BlockyTextModel(this.#delta.slice());
  }

  toJSON(): JSONNode {
    return {
      nodeName: "#text",
      textContent: this.#delta.ops,
    };
  }
}

const bannedAttributesName: Set<string> = new Set([
  "nodeName",
  "type",
  "children",
]);

interface InternAttributes {
  [key: string]: string;
}

export class BlockyElement implements BlockyNode, WithState {
  state?: State;
  parent: BlockyNode | null = null;
  nextSibling: BlockyNode | null = null;
  prevSibling: BlockyNode | null = null;

  childrenLength = 0;

  #firstChild: BlockyNode | null = null;
  #lastChild: BlockyNode | null = null;
  #attributes: InternAttributes = Object.create(null);

  changed: WithStateSlot<ElementChangedEvent> = new WithStateSlot(this);

  constructor(public nodeName: string) {
    if (nodeName === "#text") {
      throw new Error("illegal nodeName for an element");
    }
  }

  get firstChild(): BlockyNode | null {
    return this.#firstChild;
  }

  get lastChild(): BlockyNode | null {
    return this.#lastChild;
  }

  insertAfter(node: BlockyNode, after?: BlockyNode) {
    if (after && after.parent !== this) {
      throw new TypeError("after node is a child of this node");
    }
    this.#validateChild(node);
    node.parent = this;
    node.state = this.state;
    if (!after) {
      if (this.#firstChild) {
        this.#firstChild.prevSibling = node;
      }

      if (!this.#lastChild) {
        this.#lastChild = node;
      }

      node.nextSibling = this.#firstChild;
      node.prevSibling = null;

      this.#firstChild = node;
    } else {
      if (after.nextSibling) {
        after.nextSibling.prevSibling = node;
      }

      node.nextSibling = after.nextSibling;
      node.prevSibling = after;
      after.nextSibling = node;

      if (this.#lastChild === after) {
        this.#lastChild = node;
      }
    }

    this.childrenLength++;
    this.state?.handleNewBlockMounted(node);

    let cnt = 0;
    if (after) {
      let ptr: BlockyNode | null = after;
      while (ptr) {
        cnt++;
        ptr = ptr.prevSibling;
      }
    }

    this.changed.emit({
      type: "element-insert-child",
      parent: this,
      child: node,
      index: cnt,
    });

    this.#handleInsertChildren(node);
  }

  #validateChild(node: BlockyNode) {
    let ptr: BlockyElement | null = this;
    while (ptr) {
      if (ptr === node) {
        throw new Error("Can not add ancesters of a node as child");
      }
      ptr = ptr.parent as BlockyElement | null;
    }
  }

  appendChild(node: BlockyNode) {
    this.#validateChild(node);
    if (!this.#firstChild) {
      this.#firstChild = node;
    }

    if (this.#lastChild) {
      this.#lastChild.nextSibling = node;
    }

    const insertIndex = this.childrenLength;

    node.prevSibling = this.#lastChild;
    node.nextSibling = null;
    node.parent = this;
    node.state = this.state;
    this.#lastChild = node;
    this.childrenLength++;
    this.state?.handleNewBlockMounted(node);

    this.changed.emit({
      type: "element-insert-child",
      parent: this,
      child: node,
      index: insertIndex,
    });

    this.#handleInsertChildren(node);
  }

  #handleInsertChildren(node: BlockyNode) {
    const lastNode = node.lastChild;
    if (!lastNode || lastNode.nodeName !== "block-children") {
      return;
    }
    let ptr = lastNode.firstChild;
    while (ptr) {
      if (!ptr.state) {
        ptr.state = this.state;
        this.state?.handleNewBlockMounted(ptr);
      }
      ptr = ptr.nextSibling;
    }
  }

  insertChildAt(index: number, node: BlockyNode) {
    if (index === this.childrenLength) {
      this.appendChild(node);
      return;
    }

    if (index === 0) {
      this.insertAfter(node);
      return;
    }

    let ptr: BlockyNode | null = this.#firstChild;

    while (ptr && index > 1) {
      index--;
      ptr = ptr.nextSibling;
    }

    this.insertAfter(node, ptr ?? undefined);
  }

  setAttribute(name: string, value: string) {
    if (bannedAttributesName.has(name)) {
      throw new Error(`'${name}' is preserved`);
    }
    const oldValue = this.#attributes[name];
    this.#attributes[name] = value;

    this.changed.emit({
      type: "element-set-attrib",
      key: name,
      value,
      oldValue,
    });
  }

  getAttribute(name: string): string | undefined {
    return this.#attributes[name];
  }

  getAttributes(): InternAttributes {
    return { ...this.#attributes };
  }

  deleteChildrenAt(index: number, count: number) {
    let ptr = this.#firstChild;

    while (index > 0) {
      ptr = ptr?.nextSibling ?? null;
      index--;
    }

    while (ptr && count > 0) {
      const next = ptr.nextSibling;
      this.removeChild(ptr);

      ptr = next;
      count--;
    }
  }

  removeChild(node: BlockyNode) {
    const { parent } = node;
    if (parent !== this) {
      throw new TypeError("node is not the child of this element");
    }

    let ptr = 0;
    let nodePtr = node.prevSibling;
    while (nodePtr) {
      ptr++;
      nodePtr = nodePtr.prevSibling;
    }

    if (node.prevSibling) {
      node.prevSibling.nextSibling = node.nextSibling;
    }

    if (node.nextSibling) {
      node.nextSibling.prevSibling = node.prevSibling;
    }

    if (this.#firstChild === node) {
      this.#firstChild = node.nextSibling;
    }

    if (this.#lastChild === node) {
      this.#lastChild = node.prevSibling;
    }

    node.prevSibling = null;
    node.nextSibling = null;
    this.childrenLength--;

    this.state?.unmountBlock(node);

    this.changed.emit({
      type: "element-remove-child",
      parent: this,
      child: node,
      index: ptr,
    });

    this.#handleRemoveChildren(node);
  }

  #handleRemoveChildren(node: BlockyNode) {
    const lastNode = node.lastChild;
    if (!lastNode || lastNode.nodeName !== "block-children") {
      return;
    }
    let ptr = lastNode.firstChild;
    while (ptr) {
      if (!ptr.state) {
        ptr.state = this.state;
        this.state?.unmountBlock(ptr);
      }
      ptr = ptr.nextSibling;
    }
  }

  clone(): BlockyElement {
    const result = new BlockyElement(this.nodeName);

    const attribs = this.getAttributes();
    for (const key in attribs) {
      const value = attribs[key];
      if (value) {
        result.setAttribute(key, value);
      }
    }

    let childPtr = this.#firstChild;

    while (childPtr) {
      result.appendChild(childPtr.clone());
      childPtr = childPtr.nextSibling;
    }

    return result;
  }

  toJSON(): JSONNode {
    const result: JSONNode = {
      nodeName: this.nodeName,
    };

    const attributes = this.getAttributes();
    for (const key in attributes) {
      if (key === "nodeName") {
        continue;
      }
      if (key === "type") {
        continue;
      }
      const value = attributes[key];
      if (value) {
        (result as any)[key] = value;
      }
    }

    let childPtr = this.#firstChild;
    if (childPtr) {
      const children: JSONChild[] = [];

      while (childPtr) {
        const child = childPtr.toJSON();
        if (Array.isArray(child)) {
          children.push(...child);
        } else {
          children.push(child);
        }
        childPtr = childPtr.nextSibling;
      }

      result.children = children;
    }

    return result;
  }
}
