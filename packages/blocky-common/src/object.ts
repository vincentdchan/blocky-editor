// Reference: https://github.com/lodash/lodash/issues/2340
export function areEqualShallow(a: any, b: any) {
  if (typeof a === "object" && typeof b === "object") {
    if (a === null || b === null) {
      return a === b;
    }
    for (const key in a) {
      if (!(key in b) || a[key] !== b[key]) {
        return false;
      }
    }
    for (const key in b) {
      if (!(key in a)) {
        return false;
      }
    }
    return true;
  } else {
    return a === b;
  }
}
