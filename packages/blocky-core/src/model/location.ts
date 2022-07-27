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
  static transform(
    base: NodeLocation,
    location: NodeLocation,
    delta = 1
  ): NodeLocation {
    if (base.length > location.length) {
      return location;
    }
    if (base.length === 0 || location.length === 0) {
      return location;
    }
    for (let i = 0, len = base.length - 1; i < len; i++) {
      if (base.path[i] !== location.path[i]) {
        return location;
      }
    }
    const prefix = base.path.slice(0, base.length - 1);
    const suffix = location.path.slice(base.length);
    const baseLast = base.path[base.path.length - 1];
    const offsetAtIndex = location.path[base.length - 1];
    if (baseLast <= offsetAtIndex) {
      prefix.push(offsetAtIndex + delta);
    }
    prefix.push(...suffix);
    return new NodeLocation(prefix);
  }
  #hashCode: number | undefined;
  readonly path: readonly number[];
  constructor(path: number[]) {
    this.path = Object.freeze(path);
  }
  slice(start: number, end?: number): NodeLocation {
    return new NodeLocation(this.path.slice(start, end));
  }
  get last(): number {
    if (this.path.length === 0) {
      throw new Error("Location is empty");
    }
    return this.path[this.path.length - 1];
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
