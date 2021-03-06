import { isUndefined } from "lodash-es";
import Delta, { Op } from "quill-delta-es";
import { type WithState, WithStateSlot } from "@pkg/helper/withStateSlot";
import type { ElementChangedEvent } from "./events";
import type { State } from "./state";

export interface DeltaChangedEvent {
  oldDelta: Delta;
  newDelta: Delta;
}

export const symSetAttribute = Symbol("setAttribute");
export const symInsertChildAt = Symbol("insertChildAt");
export const symApplyDelta = Symbol("applyDelta");
export const symDeleteChildrenAt = Symbol("deleteChildrenAt");

export interface AttributesObject {
  [key: string]: any;
}

export interface JSONNode {
  nodeName: string;
  id?: string;
  textContent?: Op[];
  attributes?: AttributesObject;
  children?: JSONChild[];
}

export type JSONChild = JSONNode;

export interface BlockyNode {
  state?: State;

  nodeName: string;
  parent: BlockyElement | null;
  nextSibling: BlockyNode | null;
  prevSibling: BlockyNode | null;
  firstChild: BlockyNode | null;
  lastChild: BlockyNode | null;
  childrenLength: number;

  clone(): BlockyNode;
  toJSON(): JSONNode;
}

export class BlockyTextModel implements BlockyNode, WithState {
  #delta = new Delta();
  #cachedString: string | undefined;
  state?: State;
  parent: BlockyElement | null = null;
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

  [symApplyDelta](v: Delta) {
    const oldDelta = this.#delta;
    const newDelta = oldDelta.compose(v);
    this.#delta = newDelta;
    this.#cachedString = undefined;
    this.changed.emit({ oldDelta, newDelta });
  }

  toString(): string {
    if (isUndefined(this.#cachedString)) {
      this.#cachedString = this.#computeString();
    }
    return this.#cachedString;
  }

  #computeString(): string {
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
  parent: BlockyElement | null = null;
  nextSibling: BlockyNode | null = null;
  prevSibling: BlockyNode | null = null;

  childrenLength = 0;

  #firstChild: BlockyNode | null = null;
  #lastChild: BlockyNode | null = null;
  #attributes: InternAttributes = Object.create(null);

  changed: WithStateSlot<ElementChangedEvent> = new WithStateSlot(this);

  constructor(
    public nodeName: string,
    attributes?: AttributesObject,
    children?: BlockyNode[]
  ) {
    if (nodeName === "#text") {
      throw new Error("illegal nodeName for an element");
    }
    if (typeof attributes === "object") {
      for (const key in attributes) {
        this.#attributes[key] = attributes[key];
      }
    }
    if (Array.isArray(children)) {
      children.forEach((child) => this.#appendChild(child));
    }
  }

  get firstChild(): BlockyNode | null {
    return this.#firstChild;
  }

  get lastChild(): BlockyNode | null {
    return this.#lastChild;
  }

  indexOf(node: BlockyNode): number {
    let cnt = 0;
    let ptr: BlockyNode | null = node.prevSibling;
    while (ptr) {
      cnt++;
      ptr = ptr.prevSibling;
    }
    return cnt;
  }

  #symInsertAfter(node: BlockyNode, after?: BlockyNode) {
    if (after && after.parent !== this) {
      throw new TypeError("after node is a child of this node");
    }
    this.#validateChild(node);
    node.parent = this;
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

    let cnt = 0;
    if (after) {
      let ptr: BlockyNode | null = after;
      while (ptr) {
        cnt++;
        ptr = ptr.prevSibling;
      }
    }

    if (node instanceof BlockyElement) {
      node.handleMountToBlock(this.state);
    }

    this.changed.emit({
      type: "element-insert-child",
      parent: this,
      child: node,
      index: cnt,
    });
  }

  #validateChild(node: BlockyNode) {
    let ptr: BlockyElement | null = this;
    while (ptr) {
      if (ptr === node) {
        throw new Error("Can not add ancestors of a node as child");
      }
      ptr = ptr.parent;
    }
  }

  #appendChild(node: BlockyNode) {
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
    this.#lastChild = node;
    this.childrenLength++;

    if (node instanceof BlockyElement) {
      node.handleMountToBlock(this.state);
    }

    this.changed.emit({
      type: "element-insert-child",
      parent: this,
      child: node,
      index: insertIndex,
    });
  }

  handleMountToBlock(state?: State) {
    this.state = state;
    this.state?.handleNewBlockMounted(this);

    let ptr = this.firstChild;
    while (ptr) {
      if (ptr instanceof BlockyElement) {
        ptr.handleMountToBlock(state);
      }
      ptr = ptr.nextSibling;
    }
  }

  childAt(index: number): BlockyNode | null {
    let ptr: BlockyNode | null = this.#firstChild;

    while (ptr && index >= 1) {
      index--;
      ptr = ptr.nextSibling;
    }

    return ptr;
  }

  [symInsertChildAt](index: number, node: BlockyNode) {
    if (index === this.childrenLength) {
      this.#appendChild(node);
      return;
    }

    if (index === 0) {
      this.#symInsertAfter(node);
      return;
    }

    let ptr: BlockyNode | null = this.#firstChild;

    while (ptr && index > 1) {
      index--;
      ptr = ptr.nextSibling;
    }

    this.#symInsertAfter(node, ptr ?? undefined);
  }

  [symSetAttribute](name: string, value: string) {
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

  [symDeleteChildrenAt](index: number, count: number) {
    let ptr = this.#firstChild;

    while (index > 0) {
      ptr = ptr?.nextSibling ?? null;
      index--;
    }

    while (ptr && count > 0) {
      const next = ptr.nextSibling;
      this.#removeChild(ptr);

      ptr = next;
      count--;
    }
  }

  #removeChild(node: BlockyNode) {
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
        result[symSetAttribute](key, value);
      }
    }

    let childPtr = this.#firstChild;

    while (childPtr) {
      result.#appendChild(childPtr.clone());
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
