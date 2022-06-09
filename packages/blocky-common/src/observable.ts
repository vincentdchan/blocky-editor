import { IDisposable } from "./disposable";

export type Listener = (newVal: any, oldName?: any) => void;

const observableSymbol = Symbol("observable");
const actionSymbol = Symbol("aciton");

export interface ObserveProps<T> {
  name: keyof T,
  computed?: boolean,
}

interface ChangeEmitter {
  emit(propName: string, newValue: any, oldValue?: any): void;
  finalize(): void;
}

export function makeObservable<T>(target: T, ...props: ((keyof T) | ObserveProps<T>)[]) {
  const propsListeners: Map<string, Listener[]> = new Map();
  (target as any)[observableSymbol] = propsListeners;

  const emitChange = (propName: string, newValue: any, oldValue?: any) => {
    const existArr = propsListeners.get(propName);
    if (!existArr) {
      return;
    }
    for (const l of existArr) {
      try {
        l.call(undefined, newValue, oldValue);
      } catch (err) {
        console.error(err);
      }
    }
  }

  if (props.length === 0) {
    props = Object.keys(target) as (keyof T)[];
  }
  for (const prop of props) {
    let propName: keyof T; 
    let computed: boolean | undefined;

    if (typeof prop === "string") {
      propName = prop
    } else {
      // @ts-ignore
      propName = prop.name;
      // @ts-ignore
      computed = prop.computed;
    }

    if (computed) {
      // @ts-ignore
      const original: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(target.__proto__, propName);
      if (!original) {
        return;
      }

      Object.defineProperty(target, propName, {
        get() {
          return original.get!.call(target);
        },
        set: (newVal) => {
          const emitter = (target as any)[actionSymbol] as (ChangeEmitter | undefined);
          original.set!.call(target, newVal);
          if (emitter) {
            // @ts-ignore
            emitter.emit(prop as string, newVal);
          } else {
            emitChange(prop as string, newVal);
          }
        },
        enumerable: true,
        configurable: true,
      });
    } else {
      let val = target[propName];
      Object.defineProperty(target, propName, {
        get() {
          return val;
        },
        set: (newVal) => {
          const emitter = (target as any)[actionSymbol] as (ChangeEmitter | undefined);
          const oldValue = val;
          val = newVal;
          if (emitter) {
            // @ts-ignore
            emitter.emit(prop as string, newVal, oldValue);
          } else {
            emitChange(prop as string, newVal, oldValue);
          }
        },
        enumerable: true,
        configurable: true,
      });
    }
  }
}

function makeChangeEmitter(listenersMap: Map<string, Listener[]>): ChangeEmitter {
  const tmp: any = {};
  return {
    emit(propName: string, newValue: any, oldValue?: any): void {
      tmp[propName] = [newValue, oldValue];
    },
    finalize(): void {
      // @ts-ignore
      for (const [key, [newValue, oldValue]] of Object.entries(tmp)) {
        const listeners = listenersMap.get(key)!;
        for (const listener of listeners) {
          listener(newValue, oldValue);
        }
      }
    }
  }
}

export function runInAction<T = void>(obj: any, f: () => T): T {
  const propsListeners = obj[observableSymbol] as (Map<string, Listener[]> | undefined);
  if (!propsListeners) {
    throw new Error("object is not observable");
  }

  const emitter = makeChangeEmitter(propsListeners);
  obj[actionSymbol] = emitter;
  let t: any;
  try {
    t = f();
    emitter.finalize();
  } finally {
    delete obj[actionSymbol];
  }

  return t;
}

export function observe<T>(target: T, n: keyof T, listener: Listener): IDisposable {
  const name = n as string;

  const propsListeners = (target as any)[observableSymbol] as (Map<string, Listener[]> | undefined);
  if (!propsListeners) {
    throw new Error("object is not observable");
  }

  const existArr = propsListeners.get(name);
  if (existArr) {
    existArr.push(listener);
  } else {
    propsListeners.set(name, [listener]);
  }

  return {
    dispose: () => {
      const existArr = propsListeners.get(name);
      if (!existArr) {
        return;
      }
      const index = existArr.indexOf(listener);
      if (index < 0) {
        return;
      }
      existArr.splice(index, 1);
    },
  };
}

export type ArrayListener = () => void;

export function makeObservableArray<T>(t: T[]): T[] {
  const listeners: ArrayListener[] = [];

  const emitChange = () => {
    for (const l of listeners) {
      try {
        l.call(undefined);
      } catch (err) {
        console.error(err);
      }
    }
  }

  return new Proxy(t, {
    get(target: T[], key: any) {
      if (key === observableSymbol) {
        return listeners;
      } else if (key === actionSymbol) {
        // @ts-ignore
        return target[actionSymbol];
      } else if (key === "push") {
        return (...args: T[]) => {
          target.push(...args);
          // @ts-ignore
          if (target[actionSymbol]) {
            return;
          }
          emitChange();
        };
      } else if (key === "sort") {
        return (comp?: (a: T, b: T) => number) => {
          target.sort(comp);
          // @ts-ignore
          if (target[actionSymbol]) {
            return;
          }
          emitChange();
        };
      } else if (key === "splice") {
        return (start: number, ...args: any[]) => {
          const result = target.splice(start, ...args);
          // @ts-ignore
          if (target[actionSymbol]) {
            return;
          }
          emitChange();
          return result;
        };
      } else if (key === Symbol.iterator) {
        return target[Symbol.iterator].bind(target);
      }
      return target[key];
    },
    set(target: T[], key: any, value:any) {
      target[key] = value;
      // @ts-ignore
      if (target[actionSymbol]) {
        return true;
      }
      emitChange();
      return true;
    }
  });
}

export function observeArray<T>(t: T[], listener: ArrayListener): IDisposable {
  // @ts-ignore
  const listeners: ArrayListener[] | undefined = t[observableSymbol];
  if (typeof listeners === "undefined") {
    throw new Error("array is not observable");
  }

  listeners.push(listener);

  return {
    dispose: () => {
      const index = listeners.indexOf(listener);
      listeners.splice(index, 1);
    },
  }
}

export function arrayRunAction<T>(t: T[], f: (t: T[]) => void) {
  // @ts-ignore
  if (t[actionSymbol]) {
    throw new Error("already in action");
  }
  // @ts-ignore
  const listeners: ArrayListener[] | undefined = t[observableSymbol];
  if (typeof listeners === "undefined") {
    throw new Error("array is not observable");
  }

  const emitChange = () => {
    for (const l of listeners) {
      try {
        l.call(undefined);
      } catch (err) {
        console.error(err);
      }
    }
  }

  // @ts-ignore
  t[actionSymbol] = true;
  try {
    f(t);
    emitChange();
  } finally {
    // @ts-ignore
    t[actionSymbol] = undefined;
  }
}
