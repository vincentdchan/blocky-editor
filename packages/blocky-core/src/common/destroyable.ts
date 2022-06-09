import { type IDisposable } from "./disposable";
import { once } from "lodash-es";

export interface IDestroyable {
  __destroy__(): void;
}

export function detroyableToDisposable(d: IDestroyable): IDisposable {
  return {
    dispose: once(() => {
      d.__destroy__();
    })
  }
}
