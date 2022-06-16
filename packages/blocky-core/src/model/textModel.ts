import { areEqualShallow } from "blocky-common/es/object";

export interface AttributesObject {
  [key: string]: any;
}

export interface TextNode {
  prev?: TextNode;
  next?: TextNode;
  content: string;
  attributes?: AttributesObject;
}

export interface TextSlice {
  content: string;
  attributes?: AttributesObject;
}

export class TextModel {
  #nodeBegin?: TextNode;
  #nodeEnd?: TextNode;
  #length = 0;

  constructor(public readonly level: number = 0) {}

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
      if (index <= ptr.content.length && areEqualShallow(ptr.attributes, attributes)) {
        const before = ptr.content.slice(0, index);
        const after = ptr.content.slice(index);
        ptr.content = before + text + after;
        return;
      } else if (index === 0) {
        this.insertNodeBefore({ content: text, attributes }, ptr);
        break;
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
  }

  public format(index: number, length: number, attributes?: AttributesObject) {
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
          return;
        }
      }

      if (length <= 0) {
        break;
      }

      index -= ptr.content.length;
      ptr = ptr.next;
    }
  }

  public delete(index: number, length: number) {
    const end = index + length;
    if (index > this.#length || index < 0) {
      throw new Error(`The begin offset ${index} is out of range.`);
    } else if (end > this.#length || end < 0) {
      throw new Error(`The end offset ${end} is out of range.`);
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

  get nodeBegin() {
    return this.#nodeBegin;
  }

  get nodeEnd() {
    return this.#nodeEnd;
  }

  get length() {
    return this.#length;
  }
}
