/**
 * The types of the elements are referenced cyclically.
 * Do NOT split them into several files.
 * It will cause strange compilation errors by Vite.
 */
import { isUndefined } from "lodash-es";
import { Slot } from "blocky-common/es/events";
import Delta from "quill-delta-es";
import type { ElementChangedEvent } from "./events";

export interface DeltaChangedEvent {
  oldDelta: Delta;
  newDelta: Delta;
}

export const metaKey = "#meta";

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
  doc?: BlockyDocument;

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

  /**
   * Used internally.
   * If you want to modify the state of the document and
   * notify the editor to update, apply a changeset.
   */
  __applyDelta(v: Delta) {
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

export class BlockyElement implements BlockyNode {
  doc?: BlockyDocument;
  parent: BlockyElement | null = null;
  nextSibling: BlockyNode | null = null;
  prevSibling: BlockyNode | null = null;

  childrenLength = 0;

  #firstChild: BlockyNode | null = null;
  #lastChild: BlockyNode | null = null;
  #attributes: InternAttributes = {};

  changed: Slot<ElementChangedEvent> = new Slot();

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

  queryChildByName(nodeName: string): BlockyNode | void {
    let ptr = this.#firstChild;

    while (ptr) {
      if (ptr.nodeName === nodeName) {
        return ptr;
      }
      ptr = ptr.nextSibling;
    }
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

    this.doc?.reportBlockyNodeInserted(node);

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

  appendChild(node: BlockyNode) {
    if (this.doc) {
      throw new Error(
        "this method could only be called when the node is unmounted"
      );
    }

    this.#appendChildImpl(node);
  }

  #appendChildImpl(node: BlockyNode) {
    if (!this.#firstChild) {
      this.#firstChild = node;
    }

    if (this.#lastChild) {
      this.#lastChild.nextSibling = node;
    }
    node.prevSibling = this.#lastChild;
    node.nextSibling = null;
    node.parent = this;
    this.#lastChild = node;
    this.childrenLength++;
  }

  #appendChild(node: BlockyNode) {
    this.#validateChild(node);
    const insertIndex = this.childrenLength;

    this.#appendChildImpl(node);

    this.doc?.reportBlockyNodeInserted(node);

    this.changed.emit({
      type: "element-insert-child",
      parent: this,
      child: node,
      index: insertIndex,
    });
  }

  childAt(index: number): BlockyNode | null {
    let ptr: BlockyNode | null = this.#firstChild;

    while (ptr && index >= 1) {
      index--;
      ptr = ptr.nextSibling;
    }

    return ptr;
  }

  /**
   * Used internally.
   * If you want to modify the state of the document and
   * notify the editor to update, apply a changeset.
   */
  __insertChildAt(index: number, node: BlockyNode) {
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

  /**
   * Used internally.
   * If you want to modify the state of the document and
   * notify the editor to update, apply a changeset.
   */
  __setAttribute(name: string, value: string) {
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

  getTextModel(name: string): BlockyTextModel | undefined {
    return this.getAttribute<BlockyTextModel>(name);
  }

  /**
   * Used internally.
   * If you want to modify the state of the document and
   * notify the editor to update, apply a changeset.
   */
  __deleteChildrenAt(index: number, count: number) {
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

    this.doc?.reportBlockyNodeRemoved(node);

    this.changed.emit({
      type: "element-remove-child",
      parent: this,
      child: node,
      index: ptr,
    });
  }

  clone(): BlockyElement {
    const result = new BlockyElement(this.nodeName);

    const attribs = this.getAttributes();
    for (const key in attribs) {
      const value = attribs[key];
      if (value) {
        result.__setAttribute(key, value);
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

    const meta: any = {};
    const attributes: any = {};
    let hasMeta = false;
    let hasAttributes = false;
    for (const key in this.#attributes) {
      if (key === "nodeName" || key === "type" || key === "children") {
        continue;
      }
      const value = this.#attributes[key];
      if (value === null || isUndefined(value)) {
        continue;
      }
      hasAttributes = true;
      if (value instanceof BlockyTextModel) {
        hasMeta = true;
        meta[key] = "rich-text";
        attributes[key] = value.delta.ops;
      } else {
        attributes[key] = value;
      }
    }

    if (hasAttributes) {
      result.attributes = attributes;
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
    readonly id: string,
    attributes?: AttributesObject,
    children?: BlockyNode[]
  ) {
    super(blockName, attributes, children);
  }

  /**
   * Used internally.
   * If you want to modify the state of the document and
   * notify the editor to update, apply a changeset.
   */
  override __setAttribute(name: string, value: string) {
    // TODO: validate this in changeset
    if (name === "id") {
      throw new TypeError(`${name} is reserved`);
    }
    super.__setAttribute(name, value);
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
    return this.cloneWithId(this.id);
  }

  cloneWithId(id: string): BlockElement {
    const attribs = this.getAttributes();
    delete attribs.id;

    let childPtr = this.firstChild;

    const children: BlockyNode[] = [];
    while (childPtr) {
      children.push(childPtr.clone());
      childPtr = childPtr.nextSibling;
    }

    return new BlockElement(this.nodeName, id, attribs, children);
  }

  override toJSON(): JSONNode {
    const prev = super.toJSON();
    return {
      ...prev,
      id: this.id,
    };
  }
}

export interface DocumentInitProps {
  title?: string;
  head?: BlockyElement;
  body?: BlockyElement;
  bodyChildren: BlockyNode[];
}

export class BlockyDocument extends BlockyElement {
  readonly title: BlockElement;
  readonly head: BlockyElement;
  readonly body: BlockyElement;

  readonly blockElementAdded = new Slot<BlockElement>();
  readonly blockElementRemoved = new Slot<BlockElement>();

  constructor(props?: Partial<DocumentInitProps>) {
    let title: BlockElement;
    let head: BlockyElement | undefined = props?.head;
    if (isUndefined(head)) {
      title = new BlockElement("Title", "title", {
        textContent: props?.title
          ? new BlockyTextModel(new Delta([{ insert: props.title }]))
          : new BlockyTextModel(),
      });
      head = new BlockyElement("head", {}, [title]);
    } else {
      const t = head.queryChildByName("Title");
      if (!t) {
        throw new Error("Title not found for head");
      }
      title = t as BlockElement;
    }
    const body =
      props?.body ??
      new BlockyElement("body", undefined, props?.bodyChildren ?? []);
    super("document", undefined, [head, body]);

    this.title = title;
    this.head = head;
    this.body = body;

    this.reportBlockyNodeInserted(this.head);
    this.reportBlockyNodeInserted(this.body);
  }

  reportBlockyNodeInserted(blockyNode: BlockyNode) {
    traverseNode(blockyNode, (item: BlockyNode) => {
      item.doc = this;
      if (item instanceof BlockElement) {
        this.blockElementAdded.emit(item);
      }
    });
  }

  reportBlockyNodeRemoved(blockyNode: BlockyNode) {
    traverseNode(blockyNode, (item: BlockyNode) => {
      item.doc = undefined;
      if (item instanceof BlockElement) {
        this.blockElementRemoved.emit(item);
      }
    });
  }
}

export function traverseNode(
  node: BlockyNode,
  fun: (node: BlockyNode) => void
) {
  fun(node);

  if (node instanceof BlockyElement) {
    let ptr = node.firstChild;
    while (ptr) {
      traverseNode(ptr, fun);
      ptr = ptr.nextSibling;
    }
  }
}
