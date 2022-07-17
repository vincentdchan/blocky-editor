
interface Node<T> {
  value: T,
  prev?: Node<T>;
  next?: Node<T>;
}

export class FixedSizeStack<T> {
  #head: Node<T> | undefined
  #tail: Node<T> | undefined
  #length = 0
  #maxLength: number

  constructor(maxLength: number) {
    this.#maxLength = maxLength;
  }

  push(value: T) {
    if (this.#length === 0) {
      const node: Node<T> = {
        value,
      };
      this.#head = node;
      this.#tail = node;
      this.#length++;
      return;
    }
    if (this.#length >= this.#maxLength) {
      this.dequeue();
    }
    const node: Node<T> = {
      value,
      prev: this.#tail,
    };
    this.#tail!.next = node;
    this.#tail = node;
    this.#length++;
  }

  private dequeue(): T | void {
    if (this.#length === 0) {
      return;
    }

    const result = this.#head!.value;
    if (--this.#length === 0) {
      this.#head = undefined;
      this.#tail = undefined;
    } else {
      this.#head = this.#head!.next;
      if (this.#head) {
        this.#head.prev = undefined;
      }
    }
    return result;
  }

  pop(): T | void {
    if (this.#length === 0) {
      return;
    }
    const result = this.#tail!.value;

    this.#tail = this.#tail!.prev;
    if (this.#tail) {
      this.#tail!.next = undefined;
    }

    this.#length--;
    return result;
  }

  tail(): T | void {
    if (this.#length === 0) {
      return;
    }
    return this.#tail!.value;
  }

  length() {
    return this.#length;
  }

}
