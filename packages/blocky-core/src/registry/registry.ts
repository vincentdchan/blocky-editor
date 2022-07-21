export abstract class Registry<T> {
  protected sealed = false;
  seal() {
    this.sealed = true;
  }
  protected ensureUnsealed() {
    if (this.sealed) {
      throw new Error("The plugin registry is sealed");
    }
  }
  abstract register(t: T): void;
}
