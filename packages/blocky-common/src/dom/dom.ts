import { type IDisposable } from "../disposable";

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function elem<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tagName);
  if (className) {
    result.className = className;
  }
  return result;
}

export function clearAllChildren(elem: HTMLElement) {
  while (elem.lastChild) {
    elem.removeChild(elem.lastChild);
  }
}

export function removeElement(elem: HTMLElement) {
  elem.parentElement?.removeChild(elem);
}

export function removeNode(node: Node) {
  node.parentNode?.removeChild(node);
}

export function insertAtFirst(parent: HTMLElement, elem: HTMLElement) {
  parent.insertBefore(elem, parent.firstChild);
}

export function isContainNode(node: Node, parent: HTMLElement) {
  let item: Node | null = node;

  while (item) {
    if (item === parent) {
      return true;
    }
    item = item.parentNode;
  }

  return false;
}

export class DomBuilder<T extends HTMLElement> {
  readonly value: T;

  static create<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    className?: string
  ): DomBuilder<HTMLElementTagNameMap[K]> {
    return new DomBuilder(elem(tagName, className));
  }

  to(f: (t: T) => void): DomBuilder<T> {
    f(this.value);
    return this;
  }

  private constructor(v: T) {
    this.value = v;
  }

  setInnerText(content: string): DomBuilder<T> {
    this.value.innerText = content;
    return this;
  }

  mount(parent: HTMLElement | DomBuilder<T>): DomBuilder<T> {
    if (parent instanceof HTMLElement) {
      parent.appendChild(this.value);
    }
    if (parent instanceof DomBuilder) {
      parent.value.appendChild(this.value);
    }
    return this;
  }

  on<K extends keyof HTMLElementEventMap>(
    eventName: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): DomBuilder<T> {
    this.value.addEventListener(eventName, listener, options);
    return this;
  }
}

export function listenWindow<K extends keyof WindowEventMap>(
  eventName: K,
  listener: (this: Window, ev: WindowEventMap[K]) => any
): IDisposable {
  window.addEventListener(eventName, listener);
  return {
    dispose: () => {
      window.removeEventListener(eventName, listener);
    },
  };
}

export function $on<T extends HTMLElement, K extends keyof HTMLElementEventMap>(
  element: T,
  eventName: K,
  listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any
): IDisposable {
  element.addEventListener(eventName, listener);
  return {
    dispose: () => {
      element.removeEventListener(eventName, listener);
    },
  };
}

export class DivContainer implements IDisposable {
  readonly container: HTMLDivElement;

  constructor(clsName?: string) {
    this.container = elem("div", clsName);
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.container);
  }

  dispose(): void {
    removeElement(this.container);
  }
}

export class SpanContainer implements IDisposable {
  readonly container: HTMLSpanElement;

  constructor(clsName?: string) {
    this.container = elem("span", clsName);
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.container);
  }

  dispose(): void {
    removeElement(this.container);
  }
}

export function observeMutation(
  element: Node,
  options: MutationObserverInit | undefined,
  callback: MutationCallback
): IDisposable {
  const observer = new MutationObserver(callback);

  observer.observe(element, options);

  return {
    dispose() {
      observer.disconnect();
    },
  };
}
