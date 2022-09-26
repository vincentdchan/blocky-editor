import htm from "htm/mini";
import vhtml from "vhtml";

export const html = htm.bind(vhtml);

export interface AddOptions {}

class Container {
  readonly data: string[] = [];

  toString() {
    return this.data.join("");
  }
}

export class CopyContentBuilder {
  #data: Container[] = [];

  constructor() {
    this.#data.push(new Container());
  }

  peek() {
    return this.#data[this.#data.length - 1];
  }

  add(content: string | string[], options?: AddOptions) {
    if (Array.isArray(content)) {
      content.forEach((content) => this.#indeedAdd(content, options));
    } else {
      this.#indeedAdd(content, options);
    }
  }

  #indeedAdd(content: string, options?: AddOptions) {
    const container = this.peek();
    container.data.push(content);
  }

  push() {
    this.#data.push(new Container());
  }

  pop() {
    if (this.#data.length <= 1) {
      return;
    }
    this.#data.length--;
  }

  finalize() {
    while (this.#data.length > 1) {
      this.pop();
    }
  }

  toString() {
    this.finalize();
    const first = this.#data[0];
    return first.toString();
  }
}
