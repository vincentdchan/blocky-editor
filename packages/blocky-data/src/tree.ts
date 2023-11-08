/**
 * The types of the elements are referenced cyclically.
 * Do NOT split them into several files.
 * It will cause strange compilation errors by Vite.
 */
import { isUndefined, isString, isObject } from "lodash-es";
import { Subject } from "rxjs";
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

export interface DataBaseNode {
  doc?: BlockyDocument;

  nodeName: string;
  parent: DataBaseElement | null;
  nextSibling: DataBaseNode | null;
  prevSibling: DataBaseNode | null;
  firstChild: DataBaseNode | null;
  lastChild: DataBaseNode | null;
  childrenLength: number;

  clone(): DataBaseNode;
  toJSON(): JSONNode;
}

export class BlockyTextModel {
  #delta = new Delta();
  #cachedString: string | undefined;
  #cachedLength: number | undefined;

  constructor(delta?: Delta) {
    this.#delta = delta ?? new Delta();
  }

  get delta(): Delta {
    return this.#delta;
  }

  /**
   * Return the char at the index of the delta.
   * If the position is not a char(an embed), return null
   */
  charAt(index: number): string | Record<string, unknown> | undefined {
    if (index < 0 || index > this.length) {
      return undefined;
    }

    for (const op of this.#delta.ops) {
      if (isString(op.insert)) {
        if (index < op.insert.length) {
          return op.insert[index];
        }

        index -= op.insert.length;
      } else if (isObject(op.insert)) {
        if (index === 0) {
          return op.insert;
        }

        index--;
      }
    }

    return undefined;
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
    this.#cachedLength = undefined;
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
    if (isUndefined(this.#cachedLength)) {
      this.#cachedLength = this.#delta.reduce((acc, op) => {
        if (isString(op.insert)) {
          return acc + op.insert.length;
        } else if (isObject(op.insert)) {
          return acc + 1;
        }
        return acc;
      }, 0);
    }
    return this.#cachedLength;
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

export class DataBaseElement implements DataBaseNode {
  doc?: BlockyDocument;
  parent: DataBaseElement | null = null;
  nextSibling: DataBaseNode | null = null;
  prevSibling: DataBaseNode | null = null;

  childrenLength = 0;

  #firstChild: DataBaseNode | null = null;
  #lastChild: DataBaseNode | null = null;
  #attributes: InternAttributes = {};

  changed: Subject<ElementChangedEvent> = new Subject();

  constructor(
    public nodeName: string,
    attributes?: AttributesObject,
    children?: DataBaseNode[]
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

  get firstChild(): DataBaseNode | null {
    return this.#firstChild;
  }

  get lastChild(): DataBaseNode | null {
    return this.#lastChild;
  }

  indexOf(node: DataBaseNode): number {
    let cnt = 0;
    let ptr: DataBaseNode | null = node.prevSibling;
    while (ptr) {
      cnt++;
      ptr = ptr.prevSibling;
    }
    return cnt;
  }

  queryChildByName(nodeName: string): DataBaseNode | void {
    let ptr = this.#firstChild;

    while (ptr) {
      if (ptr.nodeName === nodeName) {
        return ptr;
      }
      ptr = ptr.nextSibling;
    }
  }

  #symInsertAfter(node: DataBaseNode, after?: DataBaseNode) {
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
      let ptr: DataBaseNode | null = after;
      while (ptr) {
        cnt++;
        ptr = ptr.prevSibling;
      }
    }

    this.doc?.reportBlockyNodeInserted(node);

    this.changed.next({
      type: "element-insert-child",
      parent: this,
      child: node,
      index: cnt,
    });
  }

  #validateChild(node: DataBaseNode) {
    let ptr: DataBaseElement | null = this;
    while (ptr) {
      if (ptr === node) {
        throw new Error("Can not add ancestors of a node as child");
      }
      ptr = ptr.parent;
    }
  }

  appendChild(node: DataBaseNode) {
    if (this.doc) {
      throw new Error(
        "this method could only be called when the node is unmounted"
      );
    }

    this.#appendChildImpl(node);
  }

  #appendChildImpl(node: DataBaseNode) {
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

  #appendChild(node: DataBaseNode) {
    this.#validateChild(node);
    const insertIndex = this.childrenLength;

    this.#appendChildImpl(node);

    this.doc?.reportBlockyNodeInserted(node);

    this.changed.next({
      type: "element-insert-child",
      parent: this,
      child: node,
      index: insertIndex,
    });
  }

  childAt(index: number): DataBaseNode | null {
    let ptr: DataBaseNode | null = this.#firstChild;

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
  __insertChildAt(index: number, node: DataBaseNode) {
    if (index === this.childrenLength) {
      this.#appendChild(node);
      return;
    }

    if (index === 0) {
      this.#symInsertAfter(node);
      return;
    }

    let ptr: DataBaseNode | null = this.#firstChild;

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

    this.changed.next({
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

  #removeChild(node: DataBaseNode) {
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

    this.changed.next({
      type: "element-remove-child",
      parent: this,
      child: node,
      index: ptr,
    });
  }

  clone(): DataBaseElement {
    const result = new DataBaseElement(this.nodeName);

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
export class BlockDataElement extends DataBaseElement {
  constructor(
    blockName: string,
    readonly id: string,
    attributes?: AttributesObject,
    children?: DataBaseNode[]
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

    if (parentNode instanceof BlockDataElement) {
      return parentNode.blockLevel() + 1;
    }
    return Number.MAX_SAFE_INTEGER;
  }

  override clone(): BlockDataElement {
    return this.cloneWithId(this.id);
  }

  cloneWithId(id: string): BlockDataElement {
    const attribs = this.getAttributes();
    delete attribs.id;

    let childPtr = this.firstChild;

    const children: DataBaseNode[] = [];
    while (childPtr) {
      children.push(childPtr.clone());
      childPtr = childPtr.nextSibling;
    }

    return new BlockDataElement(this.nodeName, id, attribs, children);
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
  title?: string | BlockDataElement;
  body?: DataBaseElement;
  bodyChildren: DataBaseNode[];
}

/**
 * The data model in Blocky Editor is represented as an XML Document:
 *
 * <document>
 *   <Title /> <!-- Optional -->
 *   <body>
 *     <Text />
 *     <Text />
 *     <Image src="" />
 *     </Text>
 *   </body>
 * </document>
 */
export class BlockyDocument extends DataBaseElement {
  readonly title: BlockDataElement;
  readonly body: DataBaseElement;

  readonly blockElementAdded = new Subject<BlockDataElement>();
  readonly blockElementRemoved = new Subject<BlockDataElement>();

  constructor(props?: Partial<DocumentInitProps>) {
    let title: BlockDataElement;
    title =
      props?.title instanceof BlockDataElement
        ? props.title
        : new BlockDataElement("Title", "title", {
            textContent: props?.title
              ? new BlockyTextModel(new Delta([{ insert: props.title }]))
              : new BlockyTextModel(),
          });
    const body =
      props?.body ??
      new DataBaseElement("body", undefined, props?.bodyChildren ?? []);
    super("document", undefined, [title, body]);

    this.title = title;
    this.body = body;

    this.reportBlockyNodeInserted(this.title);
    this.reportBlockyNodeInserted(this.body);
  }

  reportBlockyNodeInserted(blockyNode: DataBaseNode) {
    traverseNode(blockyNode, (item: DataBaseNode) => {
      item.doc = this;
      if (item instanceof BlockDataElement) {
        this.blockElementAdded.next(item);
      }
    });
  }

  reportBlockyNodeRemoved(blockyNode: DataBaseNode) {
    traverseNode(blockyNode, (item: DataBaseNode) => {
      item.doc = undefined;
      if (item instanceof BlockDataElement) {
        this.blockElementRemoved.next(item);
      }
    });
  }
}

export function traverseNode(
  node: DataBaseNode,
  fun: (node: DataBaseNode) => void
) {
  fun(node);

  if (node instanceof DataBaseElement) {
    let ptr = node.firstChild;
    while (ptr) {
      traverseNode(ptr, fun);
      ptr = ptr.nextSibling;
    }
  }
}
