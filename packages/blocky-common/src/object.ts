
export function areEqualShallow(a: any, b: any) {
  if (typeof a === "object" && typeof b === "object") {
    for (let key in a) {
      if (!(key in b) || a[key] !== b[key]) {
        return false;
      }
    }
    for (let key in b) {
      if (!(key in a)) {
        return false;
      }
    }
    return true;
  } else {
    return a === b;
  }
}

export function isUndefined(obj: any): obj is undefined {
  return typeof obj === "undefined";
}
