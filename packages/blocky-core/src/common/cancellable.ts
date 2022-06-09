import { IDisposable } from "./disposable";
import { Slot } from "./events";

export interface ICancellable<T> extends IDisposable {
  onSuccess(handler: (t: T) => void): ICancellable<T>;
  onError(handler: (e: Error) => void): ICancellable<T>;
}

export function makeCancellable<T>(loader: () => Promise<T>): ICancellable<T> {
  const successSlot: Slot<T> = new Slot();
  const errorSlot: Slot<Error> = new Slot();
  const result: ICancellable<T> = {
    onSuccess(handler: (t: T) => void) {
      successSlot.on(handler);
      return this;
    },
    onError(handler: (e: Error) => void) {
      errorSlot.on(handler);
      return this;
    },
    dispose() {
      successSlot.dispose();
      errorSlot.dispose();
    }
  };

  loader()
    .then(v => successSlot.emit(v))
    .catch(err => errorSlot.emit(err));

  return result;
}

export class CancellableFetch implements IDisposable {

  private abortController = new AbortController();

  constructor() {}

  emit(input: RequestInfo, init?: RequestInit): Promise<any> {
    return fetch(input, {
      ...init,
      signal: this.abortController.signal,
    });
  }

  dispose() {
    this.abortController.abort();
  }

}
