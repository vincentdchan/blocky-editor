/**
 * The types of the elements are referenced cyclically.
 * Do NOT split them into several files.
 * It will cause strange compilation errors by Vite.
 */
import { isUndefined } from "lodash-es";
import Delta from "quill-delta-es";
import { type WithState, WithStateSlot } from "@pkg/helper/withStateSlot";
import type { ElementChangedEvent } from "./events";
import type { State } from "./state";

export interface DeltaChangedEvent {
  oldDelta: Delta;
  newDelta: Delta;
}

export const metaKey = "#meta";
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
  ["#meta"]?: AttributesObject;
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

export class BlockyTextModel {
  #delta = new Delta();
  #cachedString: string | undefined;

  constructor(delta?: Delta) {
    this.#delta = delta ?? new Delta();
  }

  get delta(): Delta {
    return this.#delta;
  }

  [symApplyDelta](v: Delta) {
    const oldDelta = this.#delta;
    const newDelta = oldDelta.compose(v);
    this.#delta = newDelta;
    this.#cachedString = undefined;
    // this.changed.emit({ oldDelta, newDelta });
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

  clone(): BlockyTextModel {
    return new BlockyTextModel(this.#delta.slice());
  }
}

const bannedAttributesName: Set<string> = new Set([
  "nodeName",
  "type",
  "children",
]);

interface InternAttributes {
  [key: string]: any;
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

  get textContent(): BlockyTextModel | null {
    if (this.#firstChild instanceof BlockyTextModel) {
      return this.#firstChild;
    }
    return null;
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

  getAttribute<T = any>(name: string): T | undefined {
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

    if (node instanceof BlockyElement) {
      node.handleUnmount();
    }

    this.changed.emit({
      type: "element-remove-child",
      parent: this,
      child: node,
      index: ptr,
    });
  }

  handleUnmount() {
    this.state?.unmountBlock(this);
    let ptr = this.#firstChild;
    while (ptr) {
      if (ptr instanceof BlockyElement) {
        ptr.handleMountToBlock();
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

    const meta: any = {};
    let hasMeta = false;
    const attributes = this.getAttributes();
    for (const key in attributes) {
      if (key === "nodeName" || key === "type" || key === "children") {
        continue;
      }
      const value = attributes[key];
      if (value === null || isUndefined(value)) {
        continue;
      }
      if (value instanceof BlockyTextModel) {
        hasMeta = true;
        meta[key] = "rich-text";
        (result as any)[key] = value.delta.ops;
      } else {
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

    if (hasMeta) {
      result[metaKey] = meta;
    }

    return result;
  }
}

/**
 * This is a data layer of a block.
 * ID is used to locate a block in the document tree.
 *
 * A BlockElement can contain a <children-container>
 * at the end of the block to store the children.
 */
export class BlockElement extends BlockyElement {
  constructor(
    blockName: string,
    id: string,
    attributes?: AttributesObject,
    children?: BlockyNode[]
  ) {
    if (isUndefined(attributes)) {
      attributes = {};
    }
    attributes.id = id;
    super(blockName, attributes, children);
  }

  // validate this in changeset
  override [symSetAttribute](name: string, value: string) {
    if (name === "id") {
      throw new TypeError(`${name} is reserved`);
    }
    super[symSetAttribute](name, value);
  }

  get id(): string {
    return this.getAttribute("id")!;
  }

  /**
   * Return the level of block,
   * not the level of [Node].
   */
  blockLevel(): number {
    const parentNode = this.parent;
    if (!parentNode) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (parentNode.nodeName === "document") {
      return 0;
    }

    if (parentNode instanceof BlockElement) {
      return parentNode.blockLevel() + 1;
    }
    return Number.MAX_SAFE_INTEGER;
  }

  override clone(): BlockElement {
    const attribs = this.getAttributes();
    delete attribs.id;

    let childPtr = this.firstChild;

    const children: BlockyNode[] = [];
    while (childPtr) {
      children.push(childPtr.clone());
      childPtr = childPtr.nextSibling;
    }

    return new BlockElement(this.nodeName, this.id, attribs, children);
  }
}

export interface DocumentInitProps {
  head?: BlockyElement;
  body?: BlockyElement;
  bodyChildren: BlockyNode[];
}

export class BlockyDocument extends BlockyElement {
  readonly head: BlockyElement;
  readonly body: BlockyElement;

  constructor(props?: Partial<DocumentInitProps>) {
    const head = props?.head ?? new BlockyElement("head");
    const body =
      props?.body ??
      new BlockyElement("body", undefined, props?.bodyChildren ?? []);
    super("document", undefined, [head, body]);

    this.head = head;
    this.body = body;
  }

  override handleMountToBlock(state?: State) {
    this.state = state;
    this.head.handleMountToBlock(state);
    this.body.handleMountToBlock(state);
  }
}
