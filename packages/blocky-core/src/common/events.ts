import { IDisposable, flattenDisposable } from "./disposable";

export class Slot<T = void> implements IDisposable {

  private emitting: boolean = false;
  private callbacks: ((v: T) => any)[] = [];
  private disposables: IDisposable[] = [];

  static fromEvent<N extends keyof HTMLElementEventMap>(element: HTMLElement, eventName: N): Slot<HTMLElementEventMap[N]> {
    const slot = new Slot<HTMLElementEventMap[N]>();
    const handler = (ev: HTMLElementEventMap[N]) => {
      slot.emit(ev);
    };
    element.addEventListener(eventName, handler);
    slot.disposables.push({
      dispose: () => {
        element.removeEventListener(eventName, handler);
      },
    });
    return slot;
  }

  public on(callback: (v: T) => any): IDisposable {
    if (this.emitting) {
      const newCallback = [...this.callbacks, callback];
      this.callbacks = newCallback;
    } else {
      this.callbacks.push(callback);
    }
    return {
      dispose: () => {
        if (this.emitting) {
          this.callbacks = this.callbacks.filter(v => v !== callback);
        } else {
          const index = this.callbacks.indexOf(callback);
          if (index > -1) {
            this.callbacks.splice(index, 1); // 2nd parameter means remove one item only
          }
        }
      },
    };
  }

  public unshift(callback: (v: T) => any): IDisposable {
    if (this.emitting) {
      const newCallback = [callback, ...this.callbacks];
      this.callbacks = newCallback;
    } else {
      this.callbacks.unshift(callback);
    }
    return {
      dispose: () => {
        if (this.emitting) {
          this.callbacks = this.callbacks.filter(v => v !== callback);
        } else {
          const index = this.callbacks.indexOf(callback);
          if (index > -1) {
            this.callbacks.splice(index, 1); // 2nd parameter means remove one item only
          }
        }
      },
    };
  }

  public emit(v: T) {
    let prevEmitting = this.emitting;
    this.emitting = true;
    this.callbacks.forEach(f => {
      try {
        f(v)
      } catch (err) {
        console.error(err);
      }
    });
    this.emitting = prevEmitting;
  }

  public pipe(that: Slot<T>): Slot<T> {
    this.callbacks.push(v => that.emit(v));
    return this;
  }

  public dispose() {
    flattenDisposable(this.disposables).dispose();
    this.callbacks.length = 0;
  }

  public toDispose(disposables: IDisposable[]): Slot<T> {
    disposables.push(this);
    return this;
  }

}
