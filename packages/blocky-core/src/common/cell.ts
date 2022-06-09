import { Slot } from "./events";
import { IDisposable } from "./disposable";

export class Cell<T> implements IDisposable {

  public readonly changed = new Slot<T>();

  #value: T

  constructor(public value: T) {
    this.#value = value;
  }

  set(newValue: T) {
    this.#value = newValue;
    this.changed.emit(newValue);
  }

  get() {
    return this.#value;
  }

  dispose() {
    this.changed.dispose();
  }

}
