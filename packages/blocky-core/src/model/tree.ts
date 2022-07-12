import { areEqualShallow } from "blocky-common/es/object";
import { Slot } from "blocky-common/es/events";
import { type AttributesObject, type BlockyNode } from "./element";
import type State from "./state";

export interface WithState {
  state?: State;
}

class WithStateSlot<T = any> extends Slot<T> {

  #objWithState: WithState;

  constructor(objWithState: WithState) {
    super();
    this.#objWithState = objWithState;
  }

  public emit(v: T) {
    if (this.#objWithState.state?.silent) {
      return;
    }
    super.emit(v);
  }

}

export interface TextNode {
  prev?: TextNode;
  next?: TextNode;
  content: string;
  attributes?: AttributesObject;
}

export interface TextInsertEvent {
  type: "text-insert",
  index: number;
  text: string;
  attributes?: AttributesObject;
}

export interface TextDeleteEvent {
  type: "text-delete",
  index: number;
  length: number;
}

export interface TextFormatEvent {
  type: "text-format",
  index: number;
  length: number;
  attributes?: AttributesObject;
}

export type TextChangedEvent =
  | TextInsertEvent
  | TextDeleteEvent
  | TextFormatEvent

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

  #nodeBegin?: TextNode;
  #nodeEnd?: TextNode;
  #length = 0;

  public readonly onChanged: WithStateSlot<TextChangedEvent> = new WithStateSlot(this);

  constructor() {}

  public insert(index: number, text: string, attributes?: AttributesObject) {
    if (text.length === 0) {
      return;
    }

    this.insertData(index, text, attributes);

    this.onChanged.emit({
      type: "text-insert",
      index,
      text,
      attributes,
    });
  }

  private insertData(index: number, text: string, attributes?: AttributesObject) {
    this.#length += text.length;
    if (!this.#nodeBegin) {
      if (index !== 0) {
        throw new Error(`The begin offset ${index} is out of range.`);
      }
      this.#nodeBegin = {
        content: text,
        attributes,
      };
      this.#nodeEnd = this.#nodeBegin;
      return;
    }

    let ptr: TextNode | undefined = this.#nodeBegin;
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
          this.insertNodeBefore(mid, prev.next);
          this.insertNodeBefore(
            { content: after, attributes: prev.attributes },
            mid.next
          );
        } else {
          this.insertNodeBefore(mid, prev.next);
        }

        return;
      }

      index -= ptr.content.length;
      ptr = ptr.next;
    }

    this.insertAtLast({ content: text, attributes });
  }

  public slice(start: number, end?: number): TextSlice[] {
    const result: TextSlice[] = [];

    if (typeof end === "undefined") {
      end = this.length;
    }

    let ptr = this.nodeBegin;

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

      ptr = ptr.next;
    }

    return result;
  }

  private insertAtLast(node: TextNode) {
    node.prev = this.#nodeEnd;
    node.next = undefined;

    if (this.#nodeEnd) {
      this.#nodeEnd.next = node;
    }

    this.#nodeEnd = node;
  }

  private insertNodeBefore(node: TextNode, next?: TextNode) {
    if (!next) {
      this.insertAtLast(node);
      return;
    }

    if (next.prev) {
      next.prev.next = node;
    } else {
      this.#nodeBegin = node;
    }

    node.prev = next.prev;
    node.next = next;

    next.prev = node;
  }

  public format(index: number, length: number, attributes?: AttributesObject) {
    const originalIndex = index;
    if (index > this.#length || index < 0) {
      throw new Error(`The begin offset ${index} is out of range.`);
    }

    let ptr: TextNode | undefined = this.#nodeBegin;

    while (ptr) {
      if (index < ptr.content.length) {
        const before = ptr.content.slice(0, index);
        const lenFormatted = ptr.content.length - index;
        const next = ptr.next;

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
          this.onChanged.emit({
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
      ptr = ptr.next;
    }

    this.onChanged.emit({
      type: "text-format",
      index: originalIndex,
      length,
      attributes,
    });
  }

  public delete(index: number, length: number) {
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
    let ptr: TextNode | undefined = this.#nodeBegin;
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
          this.eraseNode(ptr);
        }
        break;
      }

      const tmp = ptr;
      index -= ptr.content.length;
      prev = ptr;
      ptr = ptr.next;

      if (tmp.content.length === 0) {
        prev = tmp.prev;
        this.eraseNode(tmp);
      }
    }

    if (prev) {
      this.tryMergeNode(prev);
    }

    this.onChanged.emit({
      type: "text-delete",
      index,
      length: originalLen,
    });
  }

  private tryMergeNode(node: TextNode) {
    const { next } = node;
    if (!next) {
      return;
    }

    if (!areEqualShallow(node.attributes, next.attributes)) {
      return;
    }

    node.content += next.content;

    this.eraseNode(next);
  }

  private eraseNode(node: TextNode) {
    if (this.#nodeBegin === node) {
      this.#nodeBegin = node.next;
    }

    if (this.#nodeEnd === node) {
      this.#nodeEnd = node.prev;
    }

    if (node.prev) {
      node.prev.next = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }

    node.prev = undefined;
    node.next = undefined;
  }

  public toString(): string {
    let result = "";
    let ptr: TextNode | undefined = this.#nodeBegin;

    while (ptr) {
      result += ptr.content;
      ptr = ptr.next;
    }

    return result;
  }

  public append(that: BlockyTextModel) {
    let ptr = that.nodeBegin;
    let index = this.#length;
    while (ptr) {
      this.insert(index, ptr.content, ptr.attributes);
      index += ptr.content.length;
      ptr = ptr.next;
    }
  }

  get nodeBegin() {
    return this.#nodeBegin;
  }

  get nodeEnd() {
    return this.#nodeEnd;
  }

  get length() {
    return this.#length;
  }

  clone(): BlockyTextModel {
    const result = new BlockyTextModel();

    let textNode = this.nodeBegin;
    let index = 0;
    while (textNode) {
      result.insert(index, textNode.content, textNode.attributes);
      index += textNode.content.length;
      textNode = textNode.next;
    }

    return result;
  }

}

const bannedAttributesName: Set<string> = new Set(["nodeName", "type"]);

export interface ElementSetAttributeEvent {
  type: "element-set-attrib",
  key: string,
  value: string;
}

export interface ElementRemoveChildEvent {
  type: "element-remove-child",
  child: BlockyNode,
  getInsertIndex: () => number,
}

export interface ElementInsertChildEvent {
  type: "element-insert-child",
  child: BlockyNode,
  getInsertIndex: () => number,
}

export type ElementChangedEvent =
  | ElementSetAttributeEvent
  | ElementInsertChildEvent
  | ElementRemoveChildEvent

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

  public onChanged: WithStateSlot<ElementChangedEvent> = new WithStateSlot(this);

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
    this.state?.handleNewBlockMounted(this, node);

    this.onChanged.emit({
      type: "element-insert-child",
      child: node,
      getInsertIndex: () => {
        if (!after) {
          return 0;
        }
        let cnt = 0;

        let ptr: BlockyNode | null = after;
        while (ptr) {
          cnt++;
          ptr = ptr.prevSibling;
        }

        return cnt;
      },
    });
  }

  appendChild(node: BlockyNode) {
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
    this.state?.handleNewBlockMounted(this, node);

    this.onChanged.emit({
      type: "element-insert-child",
      child: node,
      getInsertIndex: () => insertIndex,
    });
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
    this.#attributes[name] = value;

    this.onChanged.emit({
      type: "element-set-attrib",
      key: name,
      value,
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

    this.state?.unmountBlock(this, node);

    this.onChanged.emit({
      type: "element-remove-child",
      child: node,
      getInsertIndex: () => {
        return ptr;
      },
    });
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

}
