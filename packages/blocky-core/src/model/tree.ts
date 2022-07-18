import { isUndefined } from "lodash-es";
import { areEqualShallow } from "blocky-common/es/object";
import { type WithState, WithStateSlot } from "@pkg/helper/withStateSlot";
import type {
  JSONNode,
  JSONChild,
  AttributesObject,
  BlockyNode,
  TextDelta,
} from "./element";
import type { TextChangedEvent, ElementChangedEvent } from "./events";
import type { State } from "./state";

export interface TextNode {
  prevSibling?: TextNode;
  nextSibling?: TextNode;
  content: string;
  attributes?: AttributesObject;
}

export interface TextSlice {
  content: string;
  attributes?: AttributesObject;
}

export class BlockyTextModel implements BlockyNode, WithState {
  get nodeName(): string {
    return "#text";
  }

  state?: State;
  parent: BlockyNode | null = null;
  nextSibling: BlockyNode | null = null;
  prevSibling: BlockyNode | null = null;

  get childrenLength(): number {
    return 0;
  }

  get firstChild(): BlockyNode | null {
    return null;
  }

  get lastChild(): BlockyNode | null {
    return null;
  }

  #textBegin?: TextNode;
  #textEnd?: TextNode;
  #length = 0;

  readonly changed: WithStateSlot<TextChangedEvent> = new WithStateSlot(this);

  constructor() {}

  insert(index: number, text: string, attributes?: AttributesObject) {
    if (text.length === 0) {
      return;
    }

    this.insertData(index, text, attributes);

    this.changed.emit({
      type: "text-insert",
      index,
      text,
      attributes,
    });
  }

  private insertData(
    index: number,
    text: string,
    attributes?: AttributesObject
  ) {
    this.#length += text.length;
    if (!this.#textBegin) {
      if (index !== 0) {
        throw new Error(`The begin offset ${index} is out of range.`);
      }
      this.#textBegin = {
        content: text,
        attributes,
      };
      this.#textEnd = this.#textBegin;
      return;
    }

    let ptr: TextNode | undefined = this.#textBegin;
    while (ptr) {
      if (index === 0) {
        if (areEqualShallow(ptr.attributes, attributes)) {
          ptr.content = text + ptr.content;
        } else {
          this.insertNodeBefore({ content: text, attributes }, ptr);
        }
        return;
      } else if (index <= ptr.content.length) {
        if (areEqualShallow(ptr.attributes, attributes)) {
          const before = ptr.content.slice(0, index);
          const after = ptr.content.slice(index);
          ptr.content = before + text + after;
          return;
        }

        const before = ptr.content.slice(0, index);
        const after = ptr.content.slice(index);

        ptr.content = before;
        const prev = ptr;

        const mid: TextNode = {
          content: text,
          attributes,
        };

        if (after.length > 0) {
          this.insertNodeBefore(mid, prev.nextSibling);
          this.insertNodeBefore(
            { content: after, attributes: prev.attributes },
            mid.nextSibling
          );
        } else {
          this.insertNodeBefore(mid, prev.nextSibling);
        }

        return;
      }

      index -= ptr.content.length;
      ptr = ptr.nextSibling;
    }

    this.insertAtLast({ content: text, attributes });
  }

  slice(start: number, end?: number): TextSlice[] {
    const result: TextSlice[] = [];

    if (isUndefined(end)) {
      end = this.length;
    }

    let ptr = this.textBegin;

    while (ptr) {
      const { content, attributes } = ptr;
      if (start < ptr.content.length) {
        let tmpEnd = end;

        if (tmpEnd > content.length) {
          tmpEnd = content.length;
        }

        result.push({
          content: content.slice(Math.max(start, 0), tmpEnd),
          attributes,
        });

        if (end < 0) {
          break;
        }
      }

      start -= content.length;
      end -= content.length;

      ptr = ptr.nextSibling;
    }

    return result;
  }

  private insertAtLast(node: TextNode) {
    node.prevSibling = this.#textEnd;
    node.nextSibling = undefined;

    if (this.#textEnd) {
      this.#textEnd.nextSibling = node;
    }

    this.#textEnd = node;
  }

  private insertNodeBefore(node: TextNode, next?: TextNode) {
    if (!next) {
      this.insertAtLast(node);
      return;
    }

    if (next.prevSibling) {
      next.prevSibling.nextSibling = node;
    } else {
      this.#textBegin = node;
    }

    node.prevSibling = next.prevSibling;
    node.nextSibling = next;

    next.prevSibling = node;
  }

  format(index: number, length: number, attributes?: AttributesObject) {
    const originalIndex = index;
    if (index > this.#length || index < 0) {
      throw new Error(`The begin offset ${index} is out of range.`);
    }

    let ptr: TextNode | undefined = this.#textBegin;

    while (ptr) {
      if (index < ptr.content.length) {
        const before = ptr.content.slice(0, index);
        const lenFormatted = ptr.content.length - index;
        const next = ptr.nextSibling;

        if (length >= lenFormatted) {
          const after = ptr.content.slice(index);
          ptr.content = before;

          length -= lenFormatted;

          this.insertNodeBefore({ content: after, attributes }, next);

          index -= ptr.content.length;
          ptr = next;
          continue;
        } else {
          const mid = ptr.content.slice(index, index + length);
          const after = ptr.content.slice(index + length);
          ptr.content = before;

          this.insertNodeBefore({ content: mid, attributes }, next);
          this.insertNodeBefore(
            { content: after, attributes: ptr.attributes },
            next
          );
          this.changed.emit({
            type: "text-format",
            index: originalIndex,
            length,
            attributes,
          });
          return;
        }
      }

      if (length <= 0) {
        break;
      }

      index -= ptr.content.length;
      ptr = ptr.nextSibling;
    }

    this.changed.emit({
      type: "text-format",
      index: originalIndex,
      length,
      attributes,
    });
  }

  delete(index: number, length: number) {
    const originalLen = length;
    const end = index + length;
    if (index > this.#length || index < 0) {
      throw new Error(
        `The begin offset ${index} is out of range ${this.#length}.`
      );
    } else if (end > this.#length || end < 0) {
      throw new Error(`The end offset ${end} is out of range ${this.#length}.`);
    }
    this.#length -= length;

    let prev: TextNode | undefined;
    let ptr: TextNode | undefined = this.#textBegin;
    while (ptr) {
      if (index < ptr.content.length) {
        const before = ptr.content.slice(0, index);
        const after = ptr.content.slice(index + length);

        const lenToDelete = Math.min(ptr.content.length - index, length);

        ptr.content = before + after;
        length -= lenToDelete;
      }

      if (length <= 0) {
        if (ptr.content.length === 0) {
          this.#eraseNode(ptr);
        }
        break;
      }

      const tmp = ptr;
      index -= ptr.content.length;
      prev = ptr;
      ptr = ptr.nextSibling;

      if (tmp.content.length === 0) {
        prev = tmp.prevSibling;
        this.#eraseNode(tmp);
      }
    }

    if (prev) {
      this.#tryMergeNode(prev);
    }

    this.changed.emit({
      type: "text-delete",
      index,
      length: originalLen,
    });
  }

  #tryMergeNode(node: TextNode) {
    const { nextSibling: next } = node;
    if (!next) {
      return;
    }

    if (!areEqualShallow(node.attributes, next.attributes)) {
      return;
    }

    node.content += next.content;

    this.#eraseNode(next);
  }

  #eraseNode(node: TextNode) {
    if (this.#textBegin === node) {
      this.#textBegin = node.nextSibling;
    }

    if (this.#textEnd === node) {
      this.#textEnd = node.prevSibling;
    }

    if (node.prevSibling) {
      node.prevSibling.nextSibling = node.nextSibling;
    }

    if (node.nextSibling) {
      node.nextSibling.prevSibling = node.prevSibling;
    }

    node.prevSibling = undefined;
    node.nextSibling = undefined;
  }

  toString(): string {
    let result = "";
    let ptr: TextNode | undefined = this.#textBegin;

    while (ptr) {
      result += ptr.content;
      ptr = ptr.nextSibling;
    }

    return result;
  }

  append(that: BlockyTextModel) {
    let ptr = that.textBegin;
    let index = this.#length;
    while (ptr) {
      this.insert(index, ptr.content, ptr.attributes);
      index += ptr.content.length;
      ptr = ptr.nextSibling;
    }
  }

  get textBegin() {
    return this.#textBegin;
  }

  get textEnd() {
    return this.#textEnd;
  }

  get length() {
    return this.#length;
  }

  clone(): BlockyTextModel {
    const result = new BlockyTextModel();

    let textNode = this.textBegin;
    let index = 0;
    while (textNode) {
      result.insert(index, textNode.content, textNode.attributes);
      index += textNode.content.length;
      textNode = textNode.nextSibling;
    }

    return result;
  }

  toJSON(): JSONNode {
    const content = this.#serializeContent();
    return {
      nodeName: "#text",
      textContent: content,
    };
  }

  #serializeContent(): TextDelta[] {
    const result: TextDelta[] = [];
    let ptr = this.#textBegin;
    if (!ptr) {
      return result;
    }

    while (ptr) {
      const delta: TextDelta = {
        insert: ptr.content,
      };
      if (ptr.attributes) {
        delta.attributes = ptr.attributes;
      }
      result.push({
        insert: ptr.content,
      });
      ptr = ptr.nextSibling;
    }

    return result;
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
