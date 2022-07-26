import { isUndefined } from "lodash-es";
import { hashIntArrays } from "blocky-common/es/hash";

export class NodeLocation {
  static equals(a: NodeLocation, b: NodeLocation): boolean {
    if (a.length !== b.length) {
      return false;
    }

    if (a.hashCode !== b.hashCode) {
      return false;
    }

    for (let i = 0, len = a.length; i < len; i++) {
      if (a.path[i] !== b.path[i]) {
        return false;
      }
    }

    return true;
  }
  #hashCode: number | undefined;
  readonly path: readonly number[];
  constructor(path: number[]) {
    this.path = Object.freeze(path);
  }
  get length() {
    return this.path.length;
  }
  toString() {
    return "[" + this.path.join(", ") + "]";
  }
  get hashCode() {
    if (isUndefined(this.#hashCode)) {
      this.#hashCode = hashIntArrays(this.path);
    }
    return this.#hashCode;
  }
}
