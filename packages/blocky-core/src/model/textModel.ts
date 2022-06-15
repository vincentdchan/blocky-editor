import { areEqualShallow } from "blocky-common/es/object";

export interface AttributesObject {
  [key: string]: any;
}

interface TextNode {
  prev?: TextNode;
  next?: TextNode;
  content: string;
  attributes?: AttributesObject;
}

export class TextModel {
  #nodeBegin?: TextNode;
  #nodeEnd?: TextNode;
  #length = 0;

  public insert(index: number, text: string, attributes?: AttributesObject) {
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

    if (text.length === 0) {
      return;
    }

    let ptr: TextNode | undefined = this.#nodeBegin;
    while (ptr) {
      if (areEqualShallow(ptr.attributes, attributes)) {
        const before = ptr.content.slice(0, index);
        const after = ptr.content.slice(index);
        ptr.content = before + text + after;
        break;
      } else if (index === 0) {
        this.insertNodeBefore({ content: text, attributes }, ptr);
        break;
      }

      index -= ptr.content.length;
      ptr = ptr.next;
    }

    this.insertAtLast({ content: text, attributes });
  }

  private insertAtLast(node: TextNode) {
    node.prev = this.#nodeEnd;
    node.next = undefined;

    if (this.#nodeEnd) {
      this.#nodeEnd.next = node;
    }

    this.#nodeEnd = node;
  }

  private insertNodeBefore(node: TextNode, prev: TextNode) {
    if (prev.next) {
      prev.next.prev = node;
    } else {
      this.#nodeEnd = node;
    }

    node.prev = prev;
    node.next = prev.next;

    prev.next = node;
  }

  public format(index: number, length: number, attributes: AttributesObject) {
  }

  public delete(index: number, length: number) {
    const end = index + length;
    if (index > this.#length || index < 0) {
      throw new Error(`The begin offset ${index} is out of range.`);
    } else if (end > this.#length || end < 0) {
      throw new Error(`The end offset ${end} is out of range.`);
    }
    this.#length -= length;

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
        return;
      }

      const tmp = ptr;
      index -= ptr.content.length;
      ptr = ptr.next;

      if (tmp.content.length === 0) {
        this.eraseNode(tmp);
      }
    }
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

  get length() {
    return this.#length;
  }

}
