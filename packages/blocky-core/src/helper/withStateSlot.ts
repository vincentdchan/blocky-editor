import { Slot } from "blocky-common/es/events";
import type { State } from "@pkg/model/state";

export interface WithState {
  state?: State;
}

export class WithStateSlot<T = any> extends Slot<T> {
  #objWithState: WithState;

  constructor(objWithState: WithState) {
    super();
    this.#objWithState = objWithState;
  }

  emit(v: T) {
    if (this.#objWithState.state?.silent) {
      return;
    }
    super.emit(v);
  }
}
